from pathlib import Path
import sys

API_WORKSPACE = Path(__file__).resolve().parents[1]
if str(API_WORKSPACE) not in sys.path:
    sys.path.insert(0, str(API_WORKSPACE))

from app.core.database.session import get_session
from app.services.google_integration.presentation_ingest import ingest_google_slides_presentation
from app.services.workflow_tree import (
    create_workflow_file,
    create_workflow_folder,
    ensure_workflow_root,
)


MOCK_PRESENTATION = {
    "presentationId": "mock-intro-deck-001",
    "title": "intro-slides.pptx",
    "locale": "en-US",
    "revisionId": "rev-001",
    "pageSize": {
        "width": {"magnitude": 10.0, "unit": "IN"},
        "height": {"magnitude": 7.5, "unit": "IN"},
    },
    "slides": [
        {
            "objectId": "slide-001",
            "pageType": "SLIDE",
        },
        {
            "objectId": "slide-002",
            "pageType": "SLIDE",
        },
    ],
    "masters": [],
    "layouts": [],
    "notesMaster": {
        "objectId": "notes-master-001",
        "pageType": "NOTES_MASTER",
    },
}

MOCK_SLIDE_ENRICHMENTS = [
    {
        "slide_object_id": "slide-001",
        "time_per_slide_seconds": 45,
        "priority_queue": [
            {
                "priority_rank": 1,
                "title": "Introduce the topic clearly",
                "notes": "Open with a short overview of the presentation goal.",
            }
        ],
        "pain_points": [
            {
                "label": "Too much text",
                "severity": "medium",
                "details": "Reduce the bullet count and keep the intro concise.",
            }
        ],
    },
    {
        "slide_object_id": "slide-002",
        "time_per_slide_seconds": 60,
        "priority_queue": [
            {
                "priority_rank": 1,
                "title": "Explain the main example",
                "notes": "Pause briefly before moving to questions.",
            }
        ],
        "pain_points": [
            {
                "label": "Crowded visual",
                "severity": "low",
                "details": "Increase spacing between callouts.",
            }
        ],
    },
]


def main():
    session = get_session()

    try:
        presentation = ingest_google_slides_presentation(
            session=session,
            presentation_payload=MOCK_PRESENTATION,
            slide_enrichments=MOCK_SLIDE_ENRICHMENTS,
        )
        session.commit()

        root = ensure_workflow_root(session)
        course_folder = _find_or_create_folder(session, root.id, "Course Presentations")
        nested_folder = _find_or_create_folder(session, course_folder.id, "Demo Folder")
        _find_or_create_file(
            session,
            nested_folder.id,
            "intro-slides.pptx",
            presentation=presentation,
        )

        print("Seeded mock presentation successfully.")
        print(f"presentation_id={presentation.id}")
        print(f"google_presentation_id={presentation.google_presentation_id}")
        print("Example UI hierarchy:")
        print("Course Presentations/")
        print("  Demo Folder/")
        print("    intro-slides.pptx")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _find_or_create_folder(session, parent_id, name):
    from sqlalchemy import select

    from app.domains.decks.models import WorkflowNode

    existing = session.scalar(
        select(WorkflowNode).where(
            WorkflowNode.parent_id == parent_id,
            WorkflowNode.node_type == "folder",
            WorkflowNode.name == name,
        )
    )
    if existing is not None:
        return existing
    return create_workflow_folder(session, parent_id=parent_id, name=name)


def _find_or_create_file(session, parent_id, name, presentation):
    from sqlalchemy import select

    from app.domains.decks.models import WorkflowNode

    existing = session.scalar(
        select(WorkflowNode).where(
            WorkflowNode.parent_id == parent_id,
            WorkflowNode.node_type == "file",
            WorkflowNode.name == name,
        )
    )
    if existing is not None:
        return existing
    return create_workflow_file(
        session,
        parent_id=parent_id,
        name=name,
        source_kind="linked_presentation",
        presentation=presentation,
    )


if __name__ == "__main__":
    main()
