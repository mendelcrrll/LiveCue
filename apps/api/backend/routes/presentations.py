from uuid import UUID

from fastapi import APIRouter, Cookie, HTTPException, Response, status

from backend.database import get_session
from backend.google.presentation_import import import_google_slides_presentation
from backend.google.slides_client import GoogleSlidesClient
from backend.persistence.models import Presentation, PresentationSlide, SlidePriorityItem
from backend.persistence.workflow_tree import (
    create_workflow_file,
    create_workflow_folder,
    delete_workflow_node,
    get_workflow_tree,
)
from backend.schemas.presentations import (
    BuilderAccessibilityCheck,
    BuilderPriorityItem,
    BuilderSlide,
    BuilderSlideData,
    BuilderSlideUpdateRequest,
    BuilderTimingGoal,
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
    except ValueError as exc:
        session.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
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
def create_file(payload: WorkflowFileCreateRequest):
    session = get_session()

    try:
        node = create_workflow_file(
            session=session,
            parent_id=payload.parent_id,
            name=payload.name,
            source_kind=payload.source_kind,
            google_presentation_id=payload.google_presentation_id,
        )
        return _to_workflow_node_response(node)
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
    google_access_token: str | None = Cookie(default=None, alias="google_access_token"),
):
    if not google_access_token:
        raise HTTPException(status_code=401, detail="Missing Google access token. Re-authenticate.")

    session = get_session()

    try:
        slides_client = GoogleSlidesClient(access_token=google_access_token)
        presentation = await import_google_slides_presentation(
            session=session,
            presentation_id=payload.presentation_id,
            slides_client=slides_client,
        )
        return _to_import_response(presentation)
    except NotImplementedError as exc:
        session.rollback()
        raise HTTPException(status_code=501, detail=str(exc)) from exc
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
            extra_data={"category": item.category},
        )
        for index, item in enumerate(
            sorted(build_data.priorityItems, key=lambda priority_item: priority_item.priority)
        )
    ]


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
