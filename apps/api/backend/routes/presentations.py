from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status

from backend.database import get_session
from backend.google.presentation_import import import_google_slides_presentation
from backend.persistence.models import Presentation
from backend.persistence.workflow_tree import (
    create_workflow_file,
    create_workflow_folder,
    delete_workflow_node,
    get_workflow_tree,
)
from backend.schemas.presentations import (
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
def import_presentation(payload: PresentationImportRequest):
    session = get_session()

    try:
        presentation = import_google_slides_presentation(
            session=session,
            presentation_id=payload.presentation_id,
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


def _to_workflow_node_response(node) -> WorkflowNodeResponse:
    return WorkflowNodeResponse(
        id=str(node.id),
        parent_id=str(node.parent_id) if node.parent_id is not None else None,
        name=node.name,
        node_type=node.node_type,
        source_kind=node.source_kind,
        google_presentation_id=node.google_presentation_id,
    )
