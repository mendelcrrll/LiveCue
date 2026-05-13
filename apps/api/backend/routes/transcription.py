from __future__ import annotations

import shutil
import tempfile
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
