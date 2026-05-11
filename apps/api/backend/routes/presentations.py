import time
from uuid import UUID

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Response, status

from backend.ai.model_client import ModelClient
from backend.auth.google_auth import GoogleAuthService
from backend.database import get_session
from backend.google.presentation_import import import_google_slides_presentation
from backend.google.slides_client import GoogleSlidesClient
from backend.persistence.models import (
    Presentation,
    PresentationSlide,
    PresentationTranscriptChunk,
    SlidePriorityItem,
)
from backend.persistence.workflow_tree import (
    create_workflow_file,
    create_workflow_folder,
    delete_workflow_node,
    get_workflow_tree,
)
from backend.routes.auth import GOOGLE_CREDENTIALS_BY_USER_ID, get_google_credentials_for_session
from backend.schemas.presentations import (
    BuilderAccessibilityCheck,
    BuilderPriorityItem,
    BuilderSlide,
    BuilderSlideData,
    BuilderSlideUpdateRequest,
    BuilderTimingGoal,
    FeedbackDecision,
    FeedbackDecisionRequest,
    PresentationBuilderData,
    PresentationImportRequest,
    PresentationImportResponse,
)
from backend.schemas.workflow import (
    WorkflowFileCreateRequest,
    WorkflowFolderCreateRequest,
    WorkflowNodeResponse,
)

router = APIRouter(prefix="/presentations", tags=["presentations"])


@router.get("/tree")
def get_presentation_tree():
    session = get_session()

    try:
        return {"tree": get_presentation_tree_data(session)}
    finally:
        session.close()


def get_presentation_tree_data(session):
    return get_workflow_tree(session)


@router.get("/{presentation_id}/builder-schema", response_model=PresentationBuilderData)
def get_builder_schema(presentation_id: UUID):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        return _to_builder_response(presentation)
    finally:
        session.close()


@router.get("/{presentation_id}/slides/{slide_id}/thumbnail")
async def refresh_slide_thumbnail(
    presentation_id: UUID,
    slide_id: UUID,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    credentials = get_google_credentials_for_session(session_id)
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Connect Google to refresh presentation thumbnails.",
        )

    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        thumbnail_payload = await _fetch_thumbnail_with_refresh(
            credentials=credentials,
            presentation=presentation,
            slide=slide,
        )
        thumbnail_url = thumbnail_payload.get("contentUrl")
        if not thumbnail_url:
            raise HTTPException(status_code=502, detail="Google did not return a thumbnail URL.")

        raw_page = dict(slide.raw_page or {})
        raw_page["thumbnailUrl"] = thumbnail_url
        raw_page.setdefault("imageUrl", thumbnail_url)
        slide.raw_page = raw_page
        session.commit()

        return {"thumbnailUrl": thumbnail_url}
    except HTTPException:
        session.rollback()
        raise
    except httpx.HTTPStatusError as exc:
        session.rollback()
        raise _google_api_exception(exc) from exc
    finally:
        session.close()


@router.put(
    "/{presentation_id}/builder-schema/slides/{slide_id}",
    response_model=BuilderSlide,
)
def update_builder_slide(
    presentation_id: UUID,
    slide_id: UUID,
    payload: BuilderSlideUpdateRequest,
):
    session = get_session()

    try:
        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        _apply_builder_slide_data(session, slide, payload.buildData)
        session.commit()
        session.refresh(slide)

        return _to_builder_slide(slide)
    except HTTPException:
        session.rollback()
        raise
    except httpx.HTTPStatusError as exc:
        session.rollback()
        raise _google_api_exception(exc) from exc
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        session.close()


@router.post(
    "/{presentation_id}/slides/{slide_id}/feedback-decision",
    response_model=FeedbackDecision,
)
async def generate_feedback_decision(
    presentation_id: UUID,
    slide_id: UUID,
    payload: FeedbackDecisionRequest,
):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        window_size = payload.windowSize or 12
        transcript_chunks = _get_slide_transcript_window(
            session=session,
            presentation_id=presentation_id,
            slide_id=slide_id,
            limit=window_size,
        )

        if not transcript_chunks:
            updated_slide = _to_builder_slide(slide)
            return FeedbackDecision(
                summary="No transcript is available for this slide yet.",
                goalUpdates=[],
                accessibilityUpdates=[],
                timing=None,
                frontendUpdates=[
                    {
                        "kind": "log",
                        "action": "wait_for_transcript",
                        "message": "No transcript is available for this slide yet.",
                    }
                ],
                updatedSlide=updated_slide,
            )

        context = _build_feedback_context(
            presentation=presentation,
            slide=slide,
            build_data=payload.buildData,
            transcript_chunks=transcript_chunks,
            model=payload.model,
        )
        raw_decision = await ModelClient().generate_feedback(context)
        normalized = _normalize_feedback_decision(
            raw_decision=raw_decision,
            build_data=payload.buildData,
            elapsed_ms=transcript_chunks[-1].chunk_ended_at_ms,
        )

        _apply_feedback_decision_to_slide(
            session=session,
            slide=slide,
            build_data=payload.buildData,
            decision=normalized,
        )
        session.commit()
        session.refresh(slide)

        updated_slide = _to_builder_slide(slide)
        return FeedbackDecision(
            summary=normalized["summary"],
            goalUpdates=normalized["goalUpdates"],
            accessibilityUpdates=normalized["accessibilityUpdates"],
            timing=normalized["timing"],
            frontendUpdates=normalized["frontendUpdates"],
            updatedSlide=updated_slide,
        )
    except HTTPException:
        session.rollback()
        raise
    except RuntimeError as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=502, detail=f"Unable to generate feedback: {exc}") from exc
    finally:
        session.close()


@router.post("/folders", response_model=WorkflowNodeResponse, status_code=201)
def create_folder(payload: WorkflowFolderCreateRequest):
    session = get_session()

    try:
        node = create_workflow_folder(
            session=session,
            parent_id=payload.parent_id,
            name=payload.name,
        )
        return _to_workflow_node_response(node)
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        session.close()


@router.post("/files", response_model=WorkflowNodeResponse, status_code=201)
async def create_file(
    payload: WorkflowFileCreateRequest,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    session = get_session()

    try:
        presentation = None

        if payload.source_kind == "google_slides_request":
            credentials = get_google_credentials_for_session(session_id)
            if credentials is None:
                raise HTTPException(
                    status_code=401,
                    detail="Missing Google session. Connect Google and try again.",
                )

            slides_client = GoogleSlidesClient(access_token=credentials.access_token)
            presentation = await import_google_slides_presentation(
                session=session,
                presentation_id=payload.google_presentation_id,
                slides_client=slides_client,
            )

        node = create_workflow_file(
            session=session,
            parent_id=payload.parent_id,
            name=payload.name,
            source_kind=payload.source_kind,
            google_presentation_id=payload.google_presentation_id,
            presentation=presentation,
        )
        return _to_workflow_node_response(node)
    except HTTPException:
        session.rollback()
        raise
    except httpx.HTTPStatusError as exc:
        session.rollback()
        raise _google_api_exception(exc) from exc
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        session.close()


@router.delete("/nodes/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_node(node_id: UUID):
    session = get_session()

    try:
        delete_workflow_node(session=session, node_id=node_id)
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        session.close()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", response_model=PresentationImportResponse, status_code=201)
async def import_presentation(
    payload: PresentationImportRequest,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    credentials = get_google_credentials_for_session(session_id)
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Google session. Re-authenticate.")

    session = get_session()

    try:
        slides_client = GoogleSlidesClient(access_token=credentials.access_token)
        presentation = await import_google_slides_presentation(
            session=session,
            presentation_id=payload.presentation_id,
            slides_client=slides_client,
        )
        return _to_import_response(presentation)
    except NotImplementedError as exc:
        session.rollback()
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except httpx.HTTPStatusError as exc:
        session.rollback()
        raise _google_api_exception(exc) from exc
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _to_import_response(presentation: Presentation) -> PresentationImportResponse:
    return PresentationImportResponse(
        id=str(presentation.id),
        google_presentation_id=presentation.google_presentation_id,
        title=presentation.title,
        slide_count=len(presentation.slides),
    )


def _google_api_exception(exc: httpx.HTTPStatusError) -> HTTPException:
    try:
        detail = exc.response.json()
    except ValueError:
        detail = exc.response.text

    return HTTPException(status_code=exc.response.status_code, detail=detail)


async def _fetch_thumbnail_with_refresh(
    *,
    credentials,
    presentation: Presentation,
    slide: PresentationSlide,
) -> dict:
    client = GoogleSlidesClient(access_token=credentials.access_token)

    try:
        return await client.fetch_slide_thumbnail(
            presentation_id=presentation.google_presentation_id,
            slide_object_id=slide.google_object_id,
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 401 or not credentials.refresh_token:
            raise

        refreshed = await GoogleAuthService().refresh_access_token(
            refresh_token=credentials.refresh_token,
        )
        credentials.access_token = refreshed.access_token
        credentials.refresh_token = refreshed.refresh_token or credentials.refresh_token
        credentials.expires_at = int(time.time()) + max(refreshed.expires_in, 0)
        credentials.scope = refreshed.scope
        credentials.token_type = refreshed.token_type
        credentials.id_token = refreshed.id_token or credentials.id_token
        GOOGLE_CREDENTIALS_BY_USER_ID[credentials.user_id] = credentials

        client = GoogleSlidesClient(access_token=credentials.access_token)
        return await client.fetch_slide_thumbnail(
            presentation_id=presentation.google_presentation_id,
            slide_object_id=slide.google_object_id,
        )


def _to_builder_response(presentation: Presentation) -> PresentationBuilderData:
    return PresentationBuilderData(
        deckId=str(presentation.id),
        deckTitle=presentation.title,
        slides=[_to_builder_slide(slide) for slide in presentation.slides],
    )


def _to_builder_slide(slide) -> BuilderSlide:
    slide_number = slide.slide_index + 1
    raw_page = slide.raw_page or {}
    title = raw_page.get("title") or f"Slide {slide_number}"
    slide_text = raw_page.get("slideText") or raw_page.get("text") or []
    speaker_notes = raw_page.get("speakerNotes") or raw_page.get("notes") or ""

    if isinstance(slide_text, str):
        slide_text = [slide_text]

    timing_seconds = slide.time_per_slide_seconds or 60

    return BuilderSlide(
        slideId=str(slide.id),
        slideNumber=slide_number,
        title=title,
        slideText=slide_text,
        speakerNotes=speaker_notes,
        thumbnailUrl=raw_page.get("thumbnailUrl") or raw_page.get("imageUrl"),
        buildData=BuilderSlideData(
            priorityItems=[
                BuilderPriorityItem(
                    id=str(item.id),
                    text=item.title,
                    priority=item.priority_rank,
                    category=item.extra_data.get("category", "custom"),
                    completed=bool(item.extra_data.get("completed", False)),
                    completedAtMs=item.extra_data.get("completedAtMs"),
                    evidence=item.extra_data.get("evidence"),
                )
                for item in slide.priority_items
            ],
            accessibilityChecks=raw_page.get(
                "builderAccessibilityChecks",
                _default_accessibility_checks(),
            ),
            timingGoal=BuilderTimingGoal(
                minutes=timing_seconds // 60,
                seconds=timing_seconds % 60,
            ),
        ),
    )


def _apply_builder_slide_data(
    session,
    slide: PresentationSlide,
    build_data: BuilderSlideData,
) -> None:
    timing_seconds = build_data.timingGoal.minutes * 60 + build_data.timingGoal.seconds
    if timing_seconds <= 0:
        raise ValueError("Timing goal must be greater than zero seconds.")

    slide.time_per_slide_seconds = timing_seconds
    raw_page = dict(slide.raw_page or {})
    raw_page["builderAccessibilityChecks"] = [
        check.model_dump(mode="python") for check in build_data.accessibilityChecks
    ]
    slide.raw_page = raw_page

    slide.priority_items.clear()
    session.flush()

    slide.priority_items = [
        SlidePriorityItem(
            priority_rank=index + 1,
            title=item.text,
            extra_data={
                "category": item.category,
                "completed": item.completed,
                "completedAtMs": item.completedAtMs,
                "evidence": item.evidence,
            },
        )
        for index, item in enumerate(
            sorted(build_data.priorityItems, key=lambda priority_item: priority_item.priority)
        )
    ]


def _get_slide_transcript_window(
    *,
    session,
    presentation_id: UUID,
    slide_id: UUID,
    limit: int,
) -> list[PresentationTranscriptChunk]:
    chunks = (
        session.query(PresentationTranscriptChunk)
        .filter(
            PresentationTranscriptChunk.presentation_id == presentation_id,
            PresentationTranscriptChunk.slide_id == slide_id,
        )
        .order_by(PresentationTranscriptChunk.chunk_started_at_ms.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(chunks))


def _build_feedback_context(
    *,
    presentation: Presentation,
    slide: PresentationSlide,
    build_data: BuilderSlideData,
    transcript_chunks: list[PresentationTranscriptChunk],
    model: str | None,
) -> dict:
    raw_page = slide.raw_page or {}
    transcript_window = [
        {
            "chunkId": str(chunk.id),
            "startedAtMs": chunk.chunk_started_at_ms,
            "endedAtMs": chunk.chunk_ended_at_ms,
            "text": chunk.transcript,
        }
        for chunk in transcript_chunks
    ]
    timing_goal_seconds = build_data.timingGoal.minutes * 60 + build_data.timingGoal.seconds

    return {
        "model": model,
        "deck": {
            "id": str(presentation.id),
            "title": presentation.title,
        },
        "slide": {
            "id": str(slide.id),
            "number": slide.slide_index + 1,
            "title": raw_page.get("title") or f"Slide {slide.slide_index + 1}",
            "slideText": raw_page.get("slideText") or raw_page.get("text") or [],
            "speakerNotes": raw_page.get("speakerNotes") or raw_page.get("notes") or "",
        },
        "goals": [
            {
                "id": item.id,
                "text": item.text,
                "priority": item.priority,
                "category": item.category,
                "completed": item.completed,
                "evidence": item.evidence,
            }
        for item in sorted(
            build_data.priorityItems,
            key=lambda priority_item: priority_item.priority,
        )
        ],
        "accessibilityGoals": [
            {
                "id": check.id,
                "label": check.label,
                "enabled": check.enabled,
                "severity": check.severity,
                "status": check.status,
                "evidence": check.evidence,
            }
            for check in build_data.accessibilityChecks
        ],
        "timingGoalMs": timing_goal_seconds * 1000,
        "elapsedMs": transcript_chunks[-1].chunk_ended_at_ms,
        "transcriptWindow": transcript_window,
    }


def _normalize_feedback_decision(
    *,
    raw_decision: dict,
    build_data: BuilderSlideData,
    elapsed_ms: int,
) -> dict:
    priority_ids = {item.id for item in build_data.priorityItems}
    accessibility_ids = {check.id for check in build_data.accessibilityChecks}
    already_completed = {item.id for item in build_data.priorityItems if item.completed}

    goal_updates = []
    for item in raw_decision.get("goalUpdates", []):
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id", "")).strip()
        if item_id not in priority_ids:
            continue
        completed = bool(item.get("completed", False)) or item_id in already_completed
        goal_updates.append(
            {
                "id": item_id,
                "completed": completed,
                "evidence": str(item.get("evidence", "")).strip()[:500],
                "confidence": _clamp_confidence(item.get("confidence")),
            }
        )

    for item_id in already_completed:
        if not any(update["id"] == item_id for update in goal_updates):
            goal_updates.append(
                {
                    "id": item_id,
                    "completed": True,
                    "evidence": "",
                    "confidence": 1.0,
                }
            )

    accessibility_updates = []
    for item in raw_decision.get("accessibilityUpdates", []):
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id", "")).strip()
        if item_id not in accessibility_ids:
            continue
        status = str(item.get("status", "pending")).strip().lower()
        if status not in {"pending", "satisfied", "attention"}:
            status = "pending"
        accessibility_updates.append(
            {
                "id": item_id,
                "status": status,
                "evidence": str(item.get("evidence", "")).strip()[:500],
                "confidence": _clamp_confidence(item.get("confidence")),
            }
        )

    timing_goal_ms = (build_data.timingGoal.minutes * 60 + build_data.timingGoal.seconds) * 1000
    raw_timing = raw_decision.get("timing") if isinstance(raw_decision.get("timing"), dict) else {}
    timing_status = str(raw_timing.get("status", "unknown")).strip().lower()
    if timing_status not in {"on_track", "over_time", "under_time", "unknown"}:
        timing_status = "unknown"

    frontend_updates = raw_decision.get("frontendUpdates", [])
    if not isinstance(frontend_updates, list):
        frontend_updates = []

    return {
        "summary": str(raw_decision.get("summary", "")).strip()[:500],
        "goalUpdates": goal_updates,
        "accessibilityUpdates": accessibility_updates,
        "timing": {
            "elapsedMs": elapsed_ms,
            "goalMs": timing_goal_ms,
            "status": timing_status,
            "message": str(raw_timing.get("message", "")).strip()[:300],
        },
        "frontendUpdates": [
            update
            for update in frontend_updates[:12]
            if isinstance(update, dict) and isinstance(update.get("kind"), str)
        ],
    }


def _apply_feedback_decision_to_slide(
    *,
    session,
    slide: PresentationSlide,
    build_data: BuilderSlideData,
    decision: dict,
) -> None:
    goal_updates_by_id = {update["id"]: update for update in decision["goalUpdates"]}
    accessibility_updates_by_id = {
        update["id"]: update for update in decision["accessibilityUpdates"]
    }
    existing_priority_data_by_id = {
        str(item.id): dict(item.extra_data or {}) for item in slide.priority_items
    }

    slide.priority_items.clear()
    session.flush()
    slide.priority_items = [
        SlidePriorityItem(
            priority_rank=index + 1,
            title=item.text,
            extra_data={
                "category": item.category,
                "completed": _resolve_completed(
                    item=item,
                    update=goal_updates_by_id.get(item.id),
                    existing_data=existing_priority_data_by_id.get(item.id, {}),
                ),
                "completedAtMs": _resolve_completed_at_ms(
                    item=item,
                    update=goal_updates_by_id.get(item.id),
                    existing_data=existing_priority_data_by_id.get(item.id, {}),
                    elapsed_ms=decision["timing"]["elapsedMs"],
                ),
                "evidence": goal_updates_by_id.get(item.id, {}).get("evidence")
                or item.evidence
                or existing_priority_data_by_id.get(item.id, {}).get("evidence"),
            },
        )
        for index, item in enumerate(
            sorted(build_data.priorityItems, key=lambda priority_item: priority_item.priority)
        )
    ]

    raw_page = dict(slide.raw_page or {})
    raw_page["builderAccessibilityChecks"] = [
        {
            **check.model_dump(mode="python"),
            "status": accessibility_updates_by_id.get(check.id, {}).get("status", check.status),
            "evidence": accessibility_updates_by_id.get(check.id, {}).get(
                "evidence", check.evidence
            ),
            "updatedAtMs": decision["timing"]["elapsedMs"]
            if check.id in accessibility_updates_by_id
            else check.updatedAtMs,
        }
        for check in build_data.accessibilityChecks
    ]
    raw_page["lastFeedbackDecision"] = {
        "summary": decision["summary"],
        "frontendUpdates": decision["frontendUpdates"],
        "timing": decision["timing"],
    }
    slide.raw_page = raw_page


def _resolve_completed(
    *,
    item: BuilderPriorityItem,
    update: dict | None,
    existing_data: dict,
) -> bool:
    return bool(
        existing_data.get("completed", False) or item.completed or (update or {}).get("completed")
    )


def _resolve_completed_at_ms(
    *,
    item: BuilderPriorityItem,
    update: dict | None,
    existing_data: dict,
    elapsed_ms: int,
):
    if existing_data.get("completedAtMs") is not None:
        return existing_data.get("completedAtMs")
    if item.completedAtMs is not None:
        return item.completedAtMs
    if update and update.get("completed"):
        return elapsed_ms
    return None


def _clamp_confidence(value) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, confidence))


def _default_accessibility_checks() -> list[BuilderAccessibilityCheck]:
    return [
        BuilderAccessibilityCheck(
            id="explain-jargon",
            label="Explain jargon",
            enabled=True,
            severity="high",
        ),
        BuilderAccessibilityCheck(
            id="read-quotes",
            label="Read quotes aloud",
            enabled=True,
            severity="medium",
        ),
        BuilderAccessibilityCheck(
            id="repeat-questions",
            label="Repeat audience questions",
            enabled=False,
            severity="medium",
        ),
    ]


def _to_workflow_node_response(node) -> WorkflowNodeResponse:
    return WorkflowNodeResponse(
        id=str(node.id),
        parent_id=str(node.parent_id) if node.parent_id is not None else None,
        name=node.name,
        node_type=node.node_type,
        source_kind=node.source_kind,
        google_presentation_id=node.google_presentation_id,
    )
