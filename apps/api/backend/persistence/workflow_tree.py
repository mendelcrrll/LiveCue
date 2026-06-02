from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.persistence.models import Presentation, WorkflowNode

ROOT_SYSTEM_KEY = "workflow-root"
ROOT_NAME = "Workflow"


def get_workflow_tree(session: Session, *, owner_user_id: str | None) -> list[dict[str, Any]]:
    root = ensure_workflow_root(session)
    if owner_user_id:
        query = select(WorkflowNode).where(
            or_(
                WorkflowNode.system_key == ROOT_SYSTEM_KEY,
                WorkflowNode.owner_user_id == owner_user_id,
            )
        )
    else:
        query = select(WorkflowNode).where(WorkflowNode.system_key == ROOT_SYSTEM_KEY)

    nodes = session.scalars(
        query.order_by(WorkflowNode.sort_order.asc(), WorkflowNode.created_at.asc())
    ).all()

    payload_by_id: dict[UUID, dict[str, Any]] = {
        node.id: _serialize_node(node) for node in nodes
    }
    root_payload: dict[str, Any] | None = None

    for node in nodes:
        payload = payload_by_id[node.id]
        if node.parent_id is None:
            root_payload = payload
            continue

        parent_payload = payload_by_id.get(node.parent_id)
        if parent_payload is not None:
            parent_payload["children"].append(payload)

    return [root_payload] if root_payload is not None else [_serialize_node(root)]


def create_workflow_folder(
    session: Session,
    parent_id: UUID,
    name: str,
    *,
    owner_user_id: str,
) -> WorkflowNode:
    parent = _require_folder(session, parent_id, owner_user_id=owner_user_id)
    node = WorkflowNode(
        parent_id=parent.id,
        name=name.strip(),
        node_type="folder",
        source_kind="manual",
        owner_user_id=owner_user_id,
        sort_order=_next_sort_order(session, parent.id),
    )
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def create_workflow_file(
    session: Session,
    parent_id: UUID,
    name: str,
    *,
    source_kind: str = "manual",
    google_presentation_id: str | None = None,
    presentation: Presentation | None = None,
    owner_user_id: str,
) -> WorkflowNode:
    parent = _require_folder(session, parent_id, owner_user_id=owner_user_id)
    node = WorkflowNode(
        parent_id=parent.id,
        presentation_id=presentation.id if presentation is not None else None,
        name=name.strip(),
        node_type="file",
        source_kind=source_kind,
        google_presentation_id=google_presentation_id,
        owner_user_id=owner_user_id,
        sort_order=_next_sort_order(session, parent.id),
    )
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def delete_workflow_node(session: Session, node_id: UUID, *, owner_user_id: str) -> None:
    node = session.get(WorkflowNode, node_id)
    if node is None:
        raise ValueError("Workflow node not found.")
    if node.system_key == ROOT_SYSTEM_KEY:
        raise ValueError("The workflow root folder cannot be removed.")
    if node.owner_user_id != owner_user_id:
        raise ValueError("Workflow node not found.")

    session.delete(node)
    session.commit()


def ensure_workflow_root(session: Session) -> WorkflowNode:
    root = session.scalar(
        select(WorkflowNode).where(WorkflowNode.system_key == ROOT_SYSTEM_KEY)
    )
    if root is None:
        root = WorkflowNode(
            name=ROOT_NAME,
            node_type="folder",
            source_kind="system",
            system_key=ROOT_SYSTEM_KEY,
            sort_order=0,
        )
        session.add(root)
        session.commit()
        session.refresh(root)
    return root


def _require_folder(session: Session, node_id: UUID, *, owner_user_id: str) -> WorkflowNode:
    node = session.get(WorkflowNode, node_id)
    if node is None:
        raise ValueError("Parent folder not found.")
    if node.node_type != "folder":
        raise ValueError("Items can only be created inside folders.")
    if node.system_key != ROOT_SYSTEM_KEY and node.owner_user_id != owner_user_id:
        raise ValueError("Parent folder not found.")
    return node


def _next_sort_order(session: Session, parent_id: UUID) -> int:
    max_sort = session.scalar(
        select(func.max(WorkflowNode.sort_order)).where(WorkflowNode.parent_id == parent_id)
    )
    return 0 if max_sort is None else max_sort + 1


def _serialize_node(node: WorkflowNode) -> dict[str, Any]:
    thumbnail_url = None
    first_slide_id = None
    if node.presentation is not None and node.presentation.slides:
        first_slide = node.presentation.slides[0]
        first_slide_id = str(first_slide.id)
        raw_page = first_slide.raw_page or {}
        thumbnail_url = raw_page.get("thumbnailUrl") or raw_page.get("imageUrl")

    return {
        "id": str(node.id),
        "type": node.node_type,
        "name": node.name,
        "presentationId": str(node.presentation_id) if node.presentation_id is not None else None,
        "firstSlideId": first_slide_id,
        "thumbnailUrl": thumbnail_url,
        "sourceKind": node.source_kind,
        "googlePresentationId": node.google_presentation_id,
        "children": [],
    }
