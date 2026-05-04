from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.persistence.models import Presentation, WorkflowNode

ROOT_SYSTEM_KEY = "workflow-root"
ROOT_NAME = "Workflow"


def get_workflow_tree(session: Session) -> list[dict[str, Any]]:
    root = ensure_workflow_root(session)
    nodes = session.scalars(
        select(WorkflowNode).order_by(WorkflowNode.sort_order.asc(), WorkflowNode.created_at.asc())
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


def create_workflow_folder(session: Session, parent_id: UUID, name: str) -> WorkflowNode:
    parent = _require_folder(session, parent_id)
    node = WorkflowNode(
        parent_id=parent.id,
        name=name.strip(),
        node_type="folder",
        source_kind="manual",
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
) -> WorkflowNode:
    parent = _require_folder(session, parent_id)
    node = WorkflowNode(
        parent_id=parent.id,
        presentation_id=presentation.id if presentation is not None else None,
        name=name.strip(),
        node_type="file",
        source_kind=source_kind,
        google_presentation_id=google_presentation_id,
        sort_order=_next_sort_order(session, parent.id),
    )
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def delete_workflow_node(session: Session, node_id: UUID) -> None:
    node = session.get(WorkflowNode, node_id)
    if node is None:
        raise ValueError("Workflow node not found.")
    if node.system_key == ROOT_SYSTEM_KEY:
        raise ValueError("The workflow root folder cannot be removed.")

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


def _require_folder(session: Session, node_id: UUID) -> WorkflowNode:
    node = session.get(WorkflowNode, node_id)
    if node is None:
        raise ValueError("Parent folder not found.")
    if node.node_type != "folder":
        raise ValueError("Items can only be created inside folders.")
    return node


def _next_sort_order(session: Session, parent_id: UUID) -> int:
    max_sort = session.scalar(
        select(func.max(WorkflowNode.sort_order)).where(WorkflowNode.parent_id == parent_id)
    )
    return 0 if max_sort is None else max_sort + 1


def _serialize_node(node: WorkflowNode) -> dict[str, Any]:
    return {
        "id": str(node.id),
        "type": node.node_type,
        "name": node.name,
        "presentationId": str(node.presentation_id) if node.presentation_id is not None else None,
        "sourceKind": node.source_kind,
        "googlePresentationId": node.google_presentation_id,
        "children": [],
    }
