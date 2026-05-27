from __future__ import annotations

import shutil
import tempfile
import re
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import delete
from starlette.concurrency import run_in_threadpool

from backend.database import get_session
from backend.persistence.models import (
    Presentation,
    PresentationSlide,
    PresentationTranscriptChunk,
)
from backend.transcription.asr_transcriber import ASRTranscriber

router = APIRouter(prefix="/transcription", tags=["transcription"])

WORD_PATTERN = re.compile(r"[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)?")


@router.post("/transcribe")
async def transcribe_audio(file: Annotated[UploadFile, File(...)]):
    transcript = await _transcribe_upload(file)
    return {"text": transcript}


@router.post("/chunks")
async def transcribe_audio_chunk(
    file: Annotated[UploadFile, File(...)],
    presentation_id: Annotated[UUID, Form()],
    slide_id: Annotated[UUID, Form()],
    chunk_started_at_ms: Annotated[int, Form()],
    chunk_ended_at_ms: Annotated[int, Form()],
):
    if chunk_ended_at_ms < chunk_started_at_ms:
        raise HTTPException(status_code=400, detail="Chunk end time must be after start time.")

    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        transcript = (await _transcribe_upload(file)).strip()
        if not transcript:
            return {
                "id": None,
                "presentationId": str(presentation_id),
                "slideId": str(slide_id),
                "chunkStartedAtMs": chunk_started_at_ms,
                "chunkEndedAtMs": chunk_ended_at_ms,
                "saved": False,
                "text": "",
            }

        chunk = PresentationTranscriptChunk(
            presentation_id=presentation_id,
            slide_id=slide_id,
            chunk_started_at_ms=chunk_started_at_ms,
            chunk_ended_at_ms=chunk_ended_at_ms,
            transcript=transcript,
            extra_data={
                "filename": file.filename,
                "content_type": file.content_type,
            },
        )
        session.add(chunk)
        session.commit()
        session.refresh(chunk)

        return {
            "id": str(chunk.id),
            "presentationId": str(chunk.presentation_id),
            "slideId": str(chunk.slide_id),
            "chunkStartedAtMs": chunk.chunk_started_at_ms,
            "chunkEndedAtMs": chunk.chunk_ended_at_ms,
            "saved": True,
            "text": chunk.transcript,
        }
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=502, detail=f"Unable to transcribe audio: {exc}") from exc
    finally:
        session.close()


@router.delete("/presentations/{presentation_id}/chunks")
def delete_presentation_transcript_chunks(presentation_id: UUID):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        result = session.execute(
            delete(PresentationTranscriptChunk).where(
                PresentationTranscriptChunk.presentation_id == presentation_id
            )
        )
        session.commit()

        return {
            "presentationId": str(presentation_id),
            "deletedCount": result.rowcount or 0,
        }
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@router.get("/presentations/{presentation_id}/cadence")
def get_presentation_cadence(presentation_id: UUID):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        chunks = (
            session.query(PresentationTranscriptChunk)
            .filter(PresentationTranscriptChunk.presentation_id == presentation_id)
            .order_by(PresentationTranscriptChunk.chunk_started_at_ms.asc())
            .all()
        )

        slide_metrics_by_id = {}
        total_words = 0
        total_duration_ms = 0

        for chunk in chunks:
            word_count = _count_words(chunk.transcript)
            duration_ms = max(0, chunk.chunk_ended_at_ms - chunk.chunk_started_at_ms)
            total_words += word_count
            total_duration_ms += duration_ms

            slide = chunk.slide
            slide_id = str(chunk.slide_id)
            slide_metric = slide_metrics_by_id.setdefault(
                slide_id,
                {
                    "slideId": slide_id,
                    "slideNumber": slide.slide_index + 1 if slide is not None else None,
                    "words": 0,
                    "durationMs": 0,
                    "chunkCount": 0,
                },
            )
            slide_metric["words"] += word_count
            slide_metric["durationMs"] += duration_ms
            slide_metric["chunkCount"] += 1

        slide_metrics = []
        for metric in sorted(
            slide_metrics_by_id.values(),
            key=lambda item: item["slideNumber"] if item["slideNumber"] is not None else 10**9,
        ):
            wpm = _words_per_minute(metric["words"], metric["durationMs"])
            slide_metrics.append(
                {
                    **metric,
                    "wordsPerMinute": wpm,
                    "cadence": _cadence_label(wpm),
                }
            )

        total_wpm = _words_per_minute(total_words, total_duration_ms)
        return {
            "presentationId": str(presentation_id),
            "words": total_words,
            "durationMs": total_duration_ms,
            "chunkCount": len(chunks),
            "wordsPerMinute": total_wpm,
            "cadence": _cadence_label(total_wpm),
            "slides": slide_metrics,
        }
    finally:
        session.close()


@router.get("/presentations/{presentation_id}/timing")
def get_presentation_timing(presentation_id: UUID):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        chunks = (
            session.query(PresentationTranscriptChunk)
            .filter(PresentationTranscriptChunk.presentation_id == presentation_id)
            .order_by(PresentationTranscriptChunk.chunk_started_at_ms.asc())
            .all()
        )

        slide_metrics_by_id = {}
        total_duration_ms = 0

        for chunk in chunks:
            duration_ms = max(0, chunk.chunk_ended_at_ms - chunk.chunk_started_at_ms)
            total_duration_ms += duration_ms

            slide = chunk.slide
            slide_id = str(chunk.slide_id)
            timing_goal_ms = (slide.time_per_slide_seconds or 0) * 1000 if slide is not None else 0
            slide_metric = slide_metrics_by_id.setdefault(
                slide_id,
                {
                    "slideId": slide_id,
                    "slideNumber": slide.slide_index + 1 if slide is not None else None,
                    "durationMs": 0,
                    "goalMs": timing_goal_ms,
                    "chunkCount": 0,
                },
            )
            slide_metric["durationMs"] += duration_ms
            slide_metric["chunkCount"] += 1

        slide_metrics = []
        for metric in sorted(
            slide_metrics_by_id.values(),
            key=lambda item: item["slideNumber"] if item["slideNumber"] is not None else 10**9,
        ):
            slide_metrics.append(
                {
                    **metric,
                    "status": _timing_status(metric["durationMs"], metric["goalMs"]),
                }
            )

        return {
            "presentationId": str(presentation_id),
            "durationMs": total_duration_ms,
            "chunkCount": len(chunks),
            "slides": slide_metrics,
        }
    finally:
        session.close()


async def _transcribe_upload(file: UploadFile) -> str:
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = Path(temp_file.name)
            shutil.copyfileobj(file.file, temp_file)

        transcript = await run_in_threadpool(ASRTranscriber().transcribe, temp_path)
        return transcript
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Unable to transcribe audio: {exc}") from exc
    finally:
        await file.close()
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


def _count_words(text: str) -> int:
    return len(WORD_PATTERN.findall(text or ""))


def _words_per_minute(words: int, duration_ms: int) -> float:
    if duration_ms <= 0:
        return 0.0
    return round(words / (duration_ms / 60000), 1)


def _cadence_label(words_per_minute: float) -> str:
    if words_per_minute <= 0:
        return "no_transcript"
    if words_per_minute < 110:
        return "slow"
    if words_per_minute <= 160:
        return "steady"
    return "fast"


def _timing_status(duration_ms: int, goal_ms: int) -> str:
    if duration_ms <= 0 or goal_ms <= 0:
        return "unknown"

    ratio = duration_ms / goal_ms
    if ratio < 0.8:
        return "under_time"
    if ratio > 1.2:
        return "over_time"
    return "on_track"
