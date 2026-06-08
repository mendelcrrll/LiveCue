import re
import time
from uuid import UUID

import httpx
from fastapi import APIRouter, Cookie, HTTPException, Response, status
from fastapi.responses import RedirectResponse

from backend.ai.model_client import ModelClient
from backend.auth.google_auth import GoogleAuthService
from backend.database import get_session
from backend.google.presentation_import import import_google_slides_presentation
from backend.google.schemas import GoogleSlidesPresentationInput
from backend.google.slides_client import GoogleSlidesClient
from backend.persistence.models import (
    Presentation,
    PresentationAudienceVignette,
    PresentationPostFeedbackReport,
    PresentationSlide,
    PresentationTranscriptChunk,
    SlideDemoTranscript,
    SlidePriorityItem,
)
from backend.persistence.presentations import _add_readable_slide_context
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
    BuilderSchemaGenerationRequest,
    BuilderSlide,
    BuilderSlideData,
    BuilderSlideDemoTranscriptUpdateRequest,
    BuilderSlideNotesUpdateRequest,
    BuilderSlideUpdateRequest,
    BuilderTimingGoal,
    AudienceVignette,
    AudienceVignetteCreateRequest,
    AudienceVignetteUpdateRequest,
    FeedbackDecision,
    FeedbackDecisionRequest,
    FeedbackCriterion,
    GoogleSlidesPreviewRequest,
    GoogleSlidesPreviewResponse,
    PostFeedbackData,
    PostFeedbackGenerationRequest,
    PostFeedbackReport,
    PostFeedbackTheme,
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

POST_FEEDBACK_THEMES = [
    ("audienceTakeaway", "Audience Takeaway"),
    ("contentPriorities", "Content Priorities"),
    ("engagementConnection", "Engagement"),
    ("accessibilityDelivery", "Accessibility"),
]
THUMBNAIL_CACHE_SECONDS = 20 * 60


@router.get("/tree")
def get_presentation_tree(session_id: str | None = Cookie(default=None, alias="session_id")):
    session = get_session()
    owner_user_id = _current_user_id(session_id)

    try:
        return {"tree": get_presentation_tree_data(session, owner_user_id=owner_user_id)}
    finally:
        session.close()


def get_presentation_tree_data(session, *, owner_user_id: str | None = None):
    return get_workflow_tree(session, owner_user_id=owner_user_id)


def _current_user_id(session_id: str | None) -> str | None:
    credentials = get_google_credentials_for_session(session_id)
    return credentials.user_id if credentials is not None else None


def _require_current_user_id(session_id: str | None) -> str:
    user_id = _current_user_id(session_id)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Connect Google and try again.")
    return user_id


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


@router.get("/{presentation_id}/post-feedback", response_model=PostFeedbackData)
def get_post_feedback(presentation_id: UUID):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        return _to_post_feedback_response(presentation)
    finally:
        session.close()


@router.post(
    "/{presentation_id}/audience-vignettes",
    response_model=AudienceVignette,
    status_code=201,
)
def create_audience_vignette(presentation_id: UUID, payload: AudienceVignetteCreateRequest):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        next_sort_order = len(presentation.audience_vignettes)
        vignette = PresentationAudienceVignette(
            presentation_id=presentation_id,
            title=payload.title,
            prompt=payload.prompt,
            sort_order=next_sort_order,
        )
        session.add(vignette)
        session.commit()
        session.refresh(vignette)

        return _to_audience_vignette_response(vignette)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@router.put(
    "/{presentation_id}/audience-vignettes/{vignette_id}",
    response_model=AudienceVignette,
)
def update_audience_vignette(
    presentation_id: UUID,
    vignette_id: UUID,
    payload: AudienceVignetteUpdateRequest,
):
    session = get_session()

    try:
        vignette = session.get(PresentationAudienceVignette, vignette_id)
        if vignette is None or vignette.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Audience vignette not found.")

        vignette.title = payload.title
        vignette.prompt = payload.prompt
        session.commit()
        session.refresh(vignette)

        return _to_audience_vignette_response(vignette)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@router.delete("/{presentation_id}/audience-vignettes/{vignette_id}", status_code=204)
def delete_audience_vignette(presentation_id: UUID, vignette_id: UUID):
    session = get_session()

    try:
        vignette = session.get(PresentationAudienceVignette, vignette_id)
        if vignette is None or vignette.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Audience vignette not found.")

        session.delete(vignette)
        session.commit()
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()

    return Response(status_code=204)


@router.post(
    "/{presentation_id}/post-feedback/generate",
    response_model=PostFeedbackReport,
)
async def generate_post_feedback(
    presentation_id: UUID,
    payload: PostFeedbackGenerationRequest,
):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        vignettes = [
            vignette
            for vignette in presentation.audience_vignettes
            if vignette.prompt.strip()
        ]
        if not vignettes:
            raise HTTPException(status_code=400, detail="Save at least one audience vignette.")

        transcript_chunks = _get_presentation_transcript_chunks(
            session=session,
            presentation_id=presentation_id,
        )
        if not transcript_chunks:
            raise HTTPException(status_code=400, detail="No presentation transcript is available.")

        context = _build_post_feedback_context(
            presentation=presentation,
            vignettes=vignettes,
            transcript_chunks=transcript_chunks,
            model=payload.model,
        )
        raw_feedback = await ModelClient().generate_post_feedback(context)
        normalized_feedback = _normalize_post_feedback(raw_feedback)

        report = PresentationPostFeedbackReport(
            presentation_id=presentation_id,
            model=payload.model,
            status="completed",
            feedback_data=normalized_feedback,
            extra_data={
                "vignetteIds": [str(vignette.id) for vignette in vignettes],
                "transcriptChunkCount": len(transcript_chunks),
            },
        )
        session.add(report)
        session.commit()
        session.refresh(report)

        return _to_post_feedback_report_response(report)
    except HTTPException:
        session.rollback()
        raise
    except RuntimeError as exc:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        session.rollback()
        raise HTTPException(status_code=502, detail=f"Unable to generate post feedback: {exc}") from exc
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
        raw_page["imageUrl"] = thumbnail_url
        raw_page["thumbnailRefreshedAt"] = int(time.time())
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


@router.get("/{presentation_id}/slides/{slide_id}/thumbnail-image")
async def get_slide_thumbnail_image(
    presentation_id: UUID,
    slide_id: UUID,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    credentials = get_google_credentials_for_session(session_id)
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Connect Google to load presentation thumbnails.",
        )

    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        thumbnail_url = _get_fresh_cached_thumbnail_url(slide)
        if not thumbnail_url:
            thumbnail_payload = await _fetch_thumbnail_with_refresh(
                credentials=credentials,
                presentation=presentation,
                slide=slide,
            )
            thumbnail_url = thumbnail_payload.get("contentUrl")
            if not thumbnail_url:
                raise HTTPException(
                    status_code=502,
                    detail="Google did not return a thumbnail URL.",
                )

            raw_page = dict(slide.raw_page or {})
            raw_page["thumbnailUrl"] = thumbnail_url
            raw_page["imageUrl"] = thumbnail_url
            raw_page["thumbnailRefreshedAt"] = int(time.time())
            slide.raw_page = raw_page
            session.commit()

        return RedirectResponse(
            url=thumbnail_url,
            status_code=status.HTTP_302_FOUND,
            headers={"Cache-Control": "no-store"},
        )
    except HTTPException:
        raise
    except httpx.HTTPStatusError as exc:
        raise _google_api_exception(exc) from exc
    finally:
        session.close()


@router.post("/{presentation_id}/refresh-google-context", response_model=PresentationBuilderData)
async def refresh_google_context(
    presentation_id: UUID,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    credentials = get_google_credentials_for_session(session_id)
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Connect Google to refresh slide notes and context.",
        )

    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        presentation_payload = await _fetch_presentation_with_refresh(
            credentials=credentials,
            google_presentation_id=presentation.google_presentation_id,
        )
        normalized_payload = GoogleSlidesPresentationInput.model_validate(presentation_payload)
        _refresh_presentation_context(
            presentation=presentation,
            payload=normalized_payload,
        )
        session.commit()
        session.refresh(presentation)

        return _to_builder_response(presentation)
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


@router.put(
    "/{presentation_id}/builder-schema/slides/{slide_id}/notes",
    response_model=BuilderSlide,
)
async def update_builder_slide_notes(
    presentation_id: UUID,
    slide_id: UUID,
    payload: BuilderSlideNotesUpdateRequest,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    credentials = get_google_credentials_for_session(session_id)
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Connect Google to save speaker notes.",
        )

    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        speaker_notes_object_id = _get_speaker_notes_object_id(slide)
        if not speaker_notes_object_id:
            raise HTTPException(status_code=400, detail="Speaker notes object was not found.")

        await _update_speaker_notes_with_refresh(
            credentials=credentials,
            google_presentation_id=presentation.google_presentation_id,
            speaker_notes_object_id=speaker_notes_object_id,
            speaker_notes=payload.speakerNotes,
        )

        raw_page = dict(slide.raw_page or {})
        raw_page["speakerNotes"] = payload.speakerNotes
        slide.raw_page = raw_page
        session.commit()
        session.refresh(slide)

        return _to_builder_slide(slide)
    except HTTPException:
        session.rollback()
        raise
    except httpx.HTTPStatusError as exc:
        session.rollback()
        raise _google_api_exception(exc) from exc
    finally:
        session.close()


@router.put(
    "/{presentation_id}/builder-schema/slides/{slide_id}/demo-transcript",
    response_model=BuilderSlide,
)
def update_builder_slide_demo_transcript(
    presentation_id: UUID,
    slide_id: UUID,
    payload: BuilderSlideDemoTranscriptUpdateRequest,
):
    session = get_session()

    try:
        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        if slide.demo_transcript is None:
            slide.demo_transcript = SlideDemoTranscript(
                transcript=payload.demoTranscript,
                source=payload.source,
            )
        else:
            slide.demo_transcript.transcript = payload.demoTranscript
            slide.demo_transcript.source = payload.source

        session.commit()
        session.refresh(slide)

        return _to_builder_slide(slide)
    except HTTPException:
        session.rollback()
        raise
    finally:
        session.close()


@router.post(
    "/{presentation_id}/builder-schema/slides/{slide_id}/generate",
    response_model=BuilderSlideData,
)
async def generate_builder_slide_schema(
    presentation_id: UUID,
    slide_id: UUID,
    payload: BuilderSchemaGenerationRequest,
):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        slide = session.get(PresentationSlide, slide_id)
        if slide is None or slide.presentation_id != presentation_id:
            raise HTTPException(status_code=404, detail="Slide not found.")

        context = _build_builder_schema_context(
            presentation=presentation,
            slide=slide,
            speaker_notes_override=payload.speakerNotes,
            demo_transcript=payload.demoTranscript,
            model=payload.model,
        )
        raw_schema = await ModelClient().generate_builder_schema(context)
        return _normalize_generated_builder_schema(raw_schema=raw_schema, slide=slide)
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to generate builder schema: {exc}",
        ) from exc
    finally:
        session.close()


@router.post(
    "/{presentation_id}/reset-goal-progress",
    response_model=PresentationBuilderData,
)
def reset_presentation_goal_progress(presentation_id: UUID):
    session = get_session()

    try:
        presentation = session.get(Presentation, presentation_id)
        if presentation is None:
            raise HTTPException(status_code=404, detail="Presentation not found.")

        _reset_presentation_goal_progress(presentation)
        session.commit()
        session.refresh(presentation)

        return _to_builder_response(presentation)
    except HTTPException:
        session.rollback()
        raise
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
            slide=slide,
            elapsed_ms=transcript_chunks[-1].chunk_ended_at_ms,
        )

        if payload.persistGoalProgress:
            _apply_feedback_decision_to_slide(
                session=session,
                slide=slide,
                build_data=payload.buildData,
                decision=normalized,
            )
            session.commit()
            session.refresh(slide)
        else:
            session.rollback()

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
def create_folder(
    payload: WorkflowFolderCreateRequest,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    session = get_session()
    owner_user_id = _require_current_user_id(session_id)

    try:
        node = create_workflow_folder(
            session=session,
            parent_id=payload.parent_id,
            name=payload.name,
            owner_user_id=owner_user_id,
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
    owner_user_id = _require_current_user_id(session_id)

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
            owner_user_id=owner_user_id,
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
def delete_node(
    node_id: UUID,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    session = get_session()
    owner_user_id = _require_current_user_id(session_id)

    try:
        delete_workflow_node(session=session, node_id=node_id, owner_user_id=owner_user_id)
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


@router.post("/google-slides-preview", response_model=GoogleSlidesPreviewResponse)
async def preview_google_slides(
    payload: GoogleSlidesPreviewRequest,
    session_id: str | None = Cookie(default=None, alias="session_id"),
):
    credentials = get_google_credentials_for_session(session_id)
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Google session. Re-authenticate.")

    try:
        presentation_payload = await _fetch_presentation_with_refresh(
            credentials=credentials,
            google_presentation_id=payload.presentation_id,
        )
        first_slide = next(iter(presentation_payload.get("slides") or []), {})
        first_slide_object_id = first_slide.get("objectId")
        thumbnail_url = None

        if first_slide_object_id:
            thumbnail_payload = await _fetch_slide_thumbnail_by_google_id_with_refresh(
                credentials=credentials,
                google_presentation_id=payload.presentation_id,
                slide_object_id=first_slide_object_id,
            )
            thumbnail_url = thumbnail_payload.get("contentUrl")

        return GoogleSlidesPreviewResponse(
            google_presentation_id=payload.presentation_id,
            title=presentation_payload.get("title") or "Untitled Google Slides deck",
            first_slide_object_id=first_slide_object_id,
            thumbnail_url=thumbnail_url,
        )
    except httpx.HTTPStatusError as exc:
        raise _google_api_exception(exc) from exc


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
    return await _fetch_slide_thumbnail_by_google_id_with_refresh(
        credentials=credentials,
        google_presentation_id=presentation.google_presentation_id,
        slide_object_id=slide.google_object_id,
    )


async def _fetch_slide_thumbnail_by_google_id_with_refresh(
    *,
    credentials,
    google_presentation_id: str,
    slide_object_id: str,
) -> dict:
    client = GoogleSlidesClient(access_token=credentials.access_token)

    try:
        return await client.fetch_slide_thumbnail(
            presentation_id=google_presentation_id,
            slide_object_id=slide_object_id,
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
            presentation_id=google_presentation_id,
            slide_object_id=slide_object_id,
        )


async def _fetch_presentation_with_refresh(
    *,
    credentials,
    google_presentation_id: str,
) -> dict:
    client = GoogleSlidesClient(access_token=credentials.access_token)

    try:
        return dict(await client.fetch_presentation(google_presentation_id))
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
        return dict(await client.fetch_presentation(google_presentation_id))


def _refresh_presentation_context(
    *,
    presentation: Presentation,
    payload: GoogleSlidesPresentationInput,
) -> None:
    presentation.title = payload.title
    presentation.locale = payload.locale
    presentation.revision_id = payload.revisionId
    presentation.raw_payload = payload.model_dump(mode="python")

    existing_slides = {slide.google_object_id: slide for slide in presentation.slides}
    refreshed_slides: list[PresentationSlide] = []

    for slide_index, slide_payload in enumerate(payload.slides):
        slide = existing_slides.get(slide_payload.objectId)
        if slide is None:
            slide = PresentationSlide(google_object_id=slide_payload.objectId)

        old_raw_page = dict(slide.raw_page or {})
        next_raw_page = _add_readable_slide_context(
            slide_payload.model_dump(mode="python"),
            slide_index=slide_index,
        )
        _preserve_builder_context(old_raw_page=old_raw_page, next_raw_page=next_raw_page)

        slide.slide_index = slide_index
        slide.page_type = slide_payload.pageType
        slide.raw_page = next_raw_page
        refreshed_slides.append(slide)

    presentation.slides = refreshed_slides


def _preserve_builder_context(
    *,
    old_raw_page: dict,
    next_raw_page: dict,
) -> None:
    for key in (
        "builderAccessibilityChecks",
        "lastFeedbackDecision",
        "thumbnailUrl",
        "imageUrl",
        "thumbnailRefreshedAt",
    ):
        if old_raw_page.get(key) is not None and next_raw_page.get(key) is None:
            next_raw_page[key] = old_raw_page[key]


async def _update_speaker_notes_with_refresh(
    *,
    credentials,
    google_presentation_id: str,
    speaker_notes_object_id: str,
    speaker_notes: str,
) -> dict:
    client = GoogleSlidesClient(access_token=credentials.access_token)
    requests = _build_speaker_notes_update_requests(
        speaker_notes_object_id=speaker_notes_object_id,
        speaker_notes=speaker_notes,
    )

    try:
        return dict(await client.batch_update_presentation(google_presentation_id, requests))
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
        return dict(await client.batch_update_presentation(google_presentation_id, requests))


def _build_speaker_notes_update_requests(
    *,
    speaker_notes_object_id: str,
    speaker_notes: str,
) -> list[dict]:
    requests: list[dict] = [
        {
            "deleteText": {
                "objectId": speaker_notes_object_id,
                "textRange": {"type": "ALL"},
            }
        }
    ]

    if speaker_notes:
        requests.append(
            {
                "insertText": {
                    "objectId": speaker_notes_object_id,
                    "insertionIndex": 0,
                    "text": speaker_notes,
                }
            }
        )

    return requests


def _get_speaker_notes_object_id(slide: PresentationSlide) -> str | None:
    raw_page = slide.raw_page or {}
    notes_properties = (
        ((raw_page.get("slideProperties") or {}).get("notesPage") or {}).get("notesProperties")
        or {}
    )
    object_id = notes_properties.get("speakerNotesObjectId")
    return str(object_id) if object_id else None


def _to_post_feedback_response(presentation: Presentation) -> PostFeedbackData:
    latest_report = max(
        presentation.post_feedback_reports,
        key=lambda report: report.updated_at or report.created_at,
        default=None,
    )
    transcript_chunk_count = sum(len(slide.transcript_chunks) for slide in presentation.slides)

    return PostFeedbackData(
        deckId=str(presentation.id),
        deckTitle=presentation.title,
        vignettes=[
            _to_audience_vignette_response(vignette)
            for vignette in presentation.audience_vignettes
        ],
        feedback=_to_post_feedback_report_response(latest_report) if latest_report else None,
        transcriptChunkCount=transcript_chunk_count,
    )


def _to_audience_vignette_response(vignette: PresentationAudienceVignette) -> AudienceVignette:
    return AudienceVignette(
        id=str(vignette.id),
        title=vignette.title,
        prompt=vignette.prompt,
        sortOrder=vignette.sort_order,
        createdAt=_datetime_to_iso(vignette.created_at),
        updatedAt=_datetime_to_iso(vignette.updated_at),
    )


def _to_post_feedback_report_response(
    report: PresentationPostFeedbackReport | None,
) -> PostFeedbackReport | None:
    if report is None:
        return None

    data = _normalize_post_feedback(report.feedback_data or {})
    return PostFeedbackReport(
        id=str(report.id),
        status=report.status,
        model=report.model,
        overallScore=data.get("overallScore"),
        summary=data.get("summary", ""),
        themes=[
            PostFeedbackTheme(
                id=theme["id"],
                title=theme["title"],
                score=theme["score"],
                summary=theme["summary"],
                criteria=[
                    FeedbackCriterion(
                        label=criterion["label"],
                        score=criterion["score"],
                        feedback=criterion["feedback"],
                    )
                    for criterion in theme["criteria"]
                ],
            )
            for theme in data["themes"]
        ],
        createdAt=_datetime_to_iso(report.created_at),
        updatedAt=_datetime_to_iso(report.updated_at),
    )


def _datetime_to_iso(value) -> str | None:
    return value.isoformat() if value is not None else None


def _to_builder_response(presentation: Presentation) -> PresentationBuilderData:
    return PresentationBuilderData(
        deckId=str(presentation.id),
        deckTitle=presentation.title,
        slides=[_to_builder_slide(slide) for slide in presentation.slides],
    )


def _reset_presentation_goal_progress(presentation: Presentation) -> None:
    for slide in presentation.slides:
        for priority_item in slide.priority_items:
            extra_data = dict(priority_item.extra_data or {})
            extra_data["completed"] = False
            extra_data.pop("completedAtMs", None)
            extra_data.pop("evidence", None)
            priority_item.extra_data = extra_data

        raw_page = dict(slide.raw_page or {})
        raw_page.pop("lastFeedbackDecision", None)
        slide.raw_page = raw_page


def _to_builder_slide(slide) -> BuilderSlide:
    slide_number = slide.slide_index + 1
    raw_page = _ensure_readable_slide_context(slide)
    title = raw_page.get("title") or f"Slide {slide_number}"
    slide_text = raw_page.get("slideText") or raw_page.get("text") or []
    speaker_notes = raw_page.get("speakerNotes") or raw_page.get("notes") or ""
    demo_transcript = _get_demo_transcript_text(slide, raw_page)

    if isinstance(slide_text, str):
        slide_text = [slide_text]

    timing_seconds = slide.time_per_slide_seconds or 60

    return BuilderSlide(
        slideId=str(slide.id),
        slideNumber=slide_number,
        title=title,
        slideText=slide_text,
        speakerNotes=speaker_notes,
        demoTranscript=demo_transcript,
        thumbnailUrl=_slide_thumbnail_image_url(slide),
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


def _slide_thumbnail_image_url(slide: PresentationSlide) -> str | None:
    raw_page = slide.raw_page or {}
    if not (raw_page.get("thumbnailUrl") or raw_page.get("imageUrl")):
        return None

    return f"/api/presentations/{slide.presentation_id}/slides/{slide.id}/thumbnail-image"


def _get_fresh_cached_thumbnail_url(slide: PresentationSlide) -> str | None:
    raw_page = slide.raw_page or {}
    thumbnail_url = raw_page.get("thumbnailUrl") or raw_page.get("imageUrl")
    refreshed_at = raw_page.get("thumbnailRefreshedAt")

    if not thumbnail_url or not isinstance(refreshed_at, int):
        return None
    if time.time() - refreshed_at >= THUMBNAIL_CACHE_SECONDS:
        return None

    return thumbnail_url


def _get_demo_transcript_text(slide: PresentationSlide, raw_page: dict | None = None) -> str:
    if slide.demo_transcript is not None:
        return slide.demo_transcript.transcript

    raw_page = raw_page if raw_page is not None else slide.raw_page or {}
    return str(raw_page.get("demoTranscript") or "")


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


def _get_presentation_transcript_chunks(
    *,
    session,
    presentation_id: UUID,
) -> list[PresentationTranscriptChunk]:
    return (
        session.query(PresentationTranscriptChunk)
        .filter(PresentationTranscriptChunk.presentation_id == presentation_id)
        .order_by(PresentationTranscriptChunk.chunk_started_at_ms.asc())
        .all()
    )


def _build_post_feedback_context(
    *,
    presentation: Presentation,
    vignettes: list[PresentationAudienceVignette],
    transcript_chunks: list[PresentationTranscriptChunk],
    model: str | None,
) -> dict:
    slide_by_id = {slide.id: slide for slide in presentation.slides}

    return {
        "model": model,
        "deck": {
            "id": str(presentation.id),
            "title": presentation.title,
        },
        "audienceVignettes": [
            {
                "id": str(vignette.id),
                "title": vignette.title or f"Audience {index + 1}",
                "prompt": vignette.prompt,
            }
            for index, vignette in enumerate(vignettes)
        ],
        "slides": [_build_post_feedback_slide_context(slide) for slide in presentation.slides],
        "transcript": [
            {
                "chunkId": str(chunk.id),
                "slideId": str(chunk.slide_id),
                "slideNumber": slide_by_id[chunk.slide_id].slide_index + 1
                if chunk.slide_id in slide_by_id
                else None,
                "startedAtMs": chunk.chunk_started_at_ms,
                "endedAtMs": chunk.chunk_ended_at_ms,
                "text": chunk.transcript,
            }
            for chunk in transcript_chunks
        ],
        "themes": [
            {
                "id": theme_id,
                "title": title,
            }
            for theme_id, title in POST_FEEDBACK_THEMES
        ],
    }


def _build_post_feedback_slide_context(slide: PresentationSlide) -> dict:
    raw_page = _ensure_readable_slide_context(slide)
    return {
        "id": str(slide.id),
        "number": slide.slide_index + 1,
        "title": raw_page.get("title") or f"Slide {slide.slide_index + 1}",
        "slideText": _coerce_text_list(raw_page.get("slideText") or raw_page.get("text") or []),
        "speakerNotes": str(raw_page.get("speakerNotes") or raw_page.get("notes") or ""),
        "demoTranscript": _get_demo_transcript_text(slide, raw_page),
        "imageDescriptions": _coerce_text_list(raw_page.get("imageDescriptions") or []),
        "timingGoalSeconds": slide.time_per_slide_seconds or 0,
    }


def _normalize_post_feedback(raw_feedback: dict) -> dict:
    if not isinstance(raw_feedback, dict):
        raw_feedback = {}

    raw_themes = raw_feedback.get("themes", [])
    raw_themes_by_id = {
        str(theme.get("id", "")).strip(): theme
        for theme in raw_themes
        if isinstance(theme, dict)
    }
    normalized_themes = []

    for theme_id, title in POST_FEEDBACK_THEMES:
        raw_theme = raw_themes_by_id.get(theme_id, {})
        criteria = _normalize_post_feedback_criteria(raw_theme.get("criteria", []))
        if not criteria:
            criteria = [
                {
                    "label": "Evidence",
                    "score": 0,
                    "feedback": "The model did not return enough evidence for this theme.",
                }
            ]

        normalized_themes.append(
            {
                "id": theme_id,
                "title": str(raw_theme.get("title") or title).strip()[:80],
                "score": _clamp_score(raw_theme.get("score")),
                "summary": str(raw_theme.get("summary") or "").strip()[:700],
                "criteria": criteria,
            }
        )

    return {
        "overallScore": _clamp_score(raw_feedback.get("overallScore")),
        "summary": str(raw_feedback.get("summary") or "").strip()[:900],
        "themes": normalized_themes,
    }


def _normalize_post_feedback_criteria(raw_criteria) -> list[dict]:
    if not isinstance(raw_criteria, list):
        return []

    criteria = []
    for index, criterion in enumerate(raw_criteria[:5]):
        if not isinstance(criterion, dict):
            continue

        label = str(criterion.get("label") or f"Criterion {index + 1}").strip()[:80]
        if "body language" in label.lower():
            continue
        feedback = str(criterion.get("feedback") or "").strip()[:900]
        if "body language" in feedback.lower():
            continue
        if not feedback:
            continue

        criteria.append(
            {
                "label": label,
                "score": _clamp_score(criterion.get("score")),
                "feedback": feedback,
            }
        )

    return criteria


def _build_feedback_context(
    *,
    presentation: Presentation,
    slide: PresentationSlide,
    build_data: BuilderSlideData,
    transcript_chunks: list[PresentationTranscriptChunk],
    model: str | None,
) -> dict:
    raw_page = _ensure_readable_slide_context(slide)
    slide_text = _coerce_text_list(raw_page.get("slideText") or raw_page.get("text") or [])
    speaker_notes = str(raw_page.get("speakerNotes") or raw_page.get("notes") or "")
    demo_transcript = _get_demo_transcript_text(slide, raw_page)
    image_descriptions = _coerce_text_list(raw_page.get("imageDescriptions") or [])
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
            "slideText": slide_text,
            "speakerNotes": speaker_notes,
            "demoTranscript": demo_transcript,
            "imageDescriptions": image_descriptions,
            "visualElementCount": len(raw_page.get("pageElements", [])),
        },
        "neighborSlides": _build_neighbor_slide_context(presentation, slide),
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
        "painPoints": [
            {
                "label": pain_point.label,
                "severity": pain_point.severity,
                "details": pain_point.details,
            }
            for pain_point in slide.pain_points
        ],
        "timingGoalMs": timing_goal_seconds * 1000,
        "elapsedMs": transcript_chunks[-1].chunk_ended_at_ms,
        "transcriptWindow": transcript_window,
    }


def _build_builder_schema_context(
    *,
    presentation: Presentation,
    slide: PresentationSlide,
    speaker_notes_override: str | None,
    demo_transcript: str | None,
    model: str | None,
) -> dict:
    raw_page = _ensure_readable_slide_context(slide)
    speaker_notes = (
        speaker_notes_override
        if speaker_notes_override is not None
        else str(raw_page.get("speakerNotes") or raw_page.get("notes") or "")
    )
    resolved_demo_transcript = (
        demo_transcript
        if demo_transcript is not None
        else _get_demo_transcript_text(slide, raw_page)
    )
    current_slide = _to_builder_slide(slide)

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
            "slideText": _coerce_text_list(raw_page.get("slideText") or raw_page.get("text") or []),
            "speakerNotes": speaker_notes,
            "demoTranscript": resolved_demo_transcript,
            "imageDescriptions": _coerce_text_list(raw_page.get("imageDescriptions") or []),
            "visualElementCount": len(raw_page.get("pageElements", [])),
        },
        "neighborSlides": _build_neighbor_slide_context(presentation, slide),
        "existingBuilderSchema": current_slide.buildData.model_dump(mode="python"),
        "painPoints": [
            {
                "label": pain_point.label,
                "severity": pain_point.severity,
                "details": pain_point.details,
            }
            for pain_point in slide.pain_points
        ],
    }


def _normalize_feedback_decision(
    *,
    raw_decision: dict,
    build_data: BuilderSlideData,
    slide: PresentationSlide,
    elapsed_ms: int,
) -> dict:
    priority_ids = {item.id for item in build_data.priorityItems}
    accessibility_ids = {check.id for check in build_data.accessibilityChecks}
    already_completed = {item.id for item in build_data.priorityItems if item.completed}
    for db_item in slide.priority_items:
        if db_item.extra_data.get("completed"):
            already_completed.add(str(db_item.id))

    goal_updates = []
    for item in raw_decision.get("goalUpdates", []):
        if not isinstance(item, dict):
            continue
        item_id = str(item.get("id", "")).strip()
        if item_id not in priority_ids:
            continue
        completed = bool(item.get("completed", False)) or item_id in already_completed
        if not completed:
            continue
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
    frontend_updates = _normalize_frontend_updates(
        frontend_updates=frontend_updates,
        goal_updates=goal_updates,
        accessibility_updates=accessibility_updates,
        already_completed=already_completed,
    )

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
        "frontendUpdates": frontend_updates,
    }


def _normalize_generated_builder_schema(
    *,
    raw_schema: dict,
    slide: PresentationSlide,
) -> BuilderSlideData:
    existing = _to_builder_slide(slide).buildData
    raw_priority_items = raw_schema.get("priorityItems", [])
    priority_items = []

    if isinstance(raw_priority_items, list):
        for index, item in enumerate(raw_priority_items[:5]):
            if not isinstance(item, dict):
                continue
            text = str(item.get("text", "")).strip()
            if not text:
                continue
            priority_items.append(
                BuilderPriorityItem(
                    id=f"generated-goal-{index + 1}",
                    text=text[:255],
                    priority=len(priority_items) + 1,
                    category=str(item.get("category") or "generated")[:80],
                )
            )

    if not priority_items:
        priority_items = existing.priorityItems

    raw_timing = (
        raw_schema.get("timingGoal") if isinstance(raw_schema.get("timingGoal"), dict) else {}
    )
    total_seconds = _normalize_generated_timing_seconds(raw_timing, fallback=existing.timingGoal)

    return BuilderSlideData(
        priorityItems=priority_items,
        accessibilityChecks=_normalize_generated_accessibility_checks(
            raw_schema=raw_schema,
            existing_checks=existing.accessibilityChecks,
        ),
        timingGoal=BuilderTimingGoal(
            minutes=total_seconds // 60,
            seconds=total_seconds % 60,
        ),
    )


def _normalize_generated_timing_seconds(
    raw_timing: dict,
    *,
    fallback: BuilderTimingGoal,
) -> int:
    try:
        minutes = int(raw_timing.get("minutes", fallback.minutes))
        seconds = int(raw_timing.get("seconds", fallback.seconds))
    except (TypeError, ValueError):
        minutes = fallback.minutes
        seconds = fallback.seconds

    return min(5 * 60, max(20, minutes * 60 + seconds))


def _normalize_generated_accessibility_checks(
    *,
    raw_schema: dict,
    existing_checks: list[BuilderAccessibilityCheck],
) -> list[BuilderAccessibilityCheck]:
    existing_by_id = {check.id: check for check in existing_checks}
    raw_checks = raw_schema.get("accessibilityChecks", [])
    generated_checks = []

    if isinstance(raw_checks, list):
        for index, item in enumerate(raw_checks[:6]):
            if not isinstance(item, dict):
                continue
            label = str(item.get("label", "")).strip()
            if not label:
                continue
            item_id = str(
                item.get("id") or _slugify(label) or f"generated-accessibility-{index + 1}"
            )
            existing = existing_by_id.get(item_id)
            status = str(item.get("status", "pending")).strip().lower()
            if status not in {"pending", "attention"}:
                status = "pending"
            severity = str(
                item.get("severity", existing.severity if existing else "medium")
            ).lower()
            if severity not in {"low", "medium", "high"}:
                severity = "medium"
            generated_checks.append(
                BuilderAccessibilityCheck(
                    id=item_id[:120],
                    label=label[:120],
                    enabled=bool(item.get("enabled", True)),
                    severity=severity,
                    status=status,
                    evidence=str(item.get("evidence", "")).strip()[:500] or None,
                )
            )

    if not generated_checks:
        return existing_checks

    return generated_checks


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:80]


def _build_neighbor_slide_context(presentation: Presentation, slide: PresentationSlide) -> dict:
    slides_by_index = {candidate.slide_index: candidate for candidate in presentation.slides}
    return {
        "previous": _summarize_neighbor_slide(slides_by_index.get(slide.slide_index - 1)),
        "next": _summarize_neighbor_slide(slides_by_index.get(slide.slide_index + 1)),
    }


def _summarize_neighbor_slide(slide: PresentationSlide | None) -> dict | None:
    if slide is None:
        return None

    raw_page = _ensure_readable_slide_context(slide)
    return {
        "number": slide.slide_index + 1,
        "title": raw_page.get("title") or f"Slide {slide.slide_index + 1}",
        "slideText": _coerce_text_list(raw_page.get("slideText") or raw_page.get("text") or [])[
            :5
        ],
    }


def _ensure_readable_slide_context(slide: PresentationSlide) -> dict:
    raw_page = slide.raw_page or {}
    if raw_page.get("slideText") is not None and raw_page.get("speakerNotes") is not None:
        return raw_page
    return _add_readable_slide_context(raw_page, slide_index=slide.slide_index)


def _coerce_text_list(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(item)[:500] for item in value if str(item).strip()]
    return []


def _normalize_frontend_updates(
    *,
    frontend_updates: list,
    goal_updates: list[dict],
    accessibility_updates: list[dict],
    already_completed: set[str],
) -> list[dict]:
    canonical_updates: list[dict] = [
        {
            "kind": "goal",
            "id": update["id"],
            "action": "goal_completed",
            "message": "Goal reached.",
        }
        for update in goal_updates
        if update["completed"] and update["id"] not in already_completed
    ]

    for update in accessibility_updates:
        if update["status"] == "pending":
            continue
        canonical_updates.append(
            {
                "kind": "accessibility",
                "id": update["id"],
                "action": f"accessibility_{update['status']}",
                "message": update["evidence"] or f"Accessibility check {update['status']}.",
            }
        )

    for update in frontend_updates:
        if not isinstance(update, dict) or not isinstance(update.get("kind"), str):
            continue
        if update.get("kind") == "goal":
            continue
        canonical_updates.append(
            {
                "kind": str(update.get("kind", "log"))[:40],
                "id": str(update.get("id", ""))[:120] or None,
                "action": str(update.get("action", "update"))[:120],
                "message": str(update.get("message", ""))[:300],
            }
        )

    return canonical_updates[:12]


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


def _clamp_score(value) -> int:
    try:
        score = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, min(100, score))


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
