from pathlib import Path
import sys

from sqlalchemy import delete

API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from backend.database import get_session
from backend.google.presentation_ingest import ingest_google_slides_presentation
from backend.persistence.models import PresentationTranscriptChunk
from backend.persistence.workflow_tree import (
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
        {
            "objectId": "slide-003",
            "pageType": "SLIDE",
        },
        {
            "objectId": "slide-004",
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
    {
        "slide_object_id": "slide-003",
        "time_per_slide_seconds": 75,
        "priority_queue": [
            {
                "priority_rank": 1,
                "title": "Show audience-specific feedback",
                "notes": "Compare generic comments with feedback from a specific listener profile.",
            }
        ],
        "pain_points": [
            {
                "label": "Needs concrete example",
                "severity": "medium",
                "details": "Use a short transcript excerpt to show how the vignette changes feedback.",
            }
        ],
    },
    {
        "slide_object_id": "slide-004",
        "time_per_slide_seconds": 60,
        "priority_queue": [
            {
                "priority_rank": 1,
                "title": "Close with next steps",
                "notes": "Summarize how the presenter should use feedback after the session.",
            }
        ],
        "pain_points": [
            {
                "label": "Accessibility opportunity",
                "severity": "low",
                "details": "Verbally describe the key visual and avoid relying only on color.",
            }
        ],
    },
]

MOCK_TRANSCRIPT_CHUNKS = [
    {
        "slide_object_id": "slide-001",
        "chunk_started_at_ms": 0,
        "chunk_ended_at_ms": 42000,
        "transcript": (
            "Today I want to talk about why presentation feedback often arrives too late "
            "to be useful. Most speakers finish their talk and hear broad comments like good job "
            "or be clearer, but they do not learn what a specific audience actually took away."
        ),
    },
    {
        "slide_object_id": "slide-002",
        "chunk_started_at_ms": 42000,
        "chunk_ended_at_ms": 106000,
        "transcript": (
            "Our system records a presenter slide by slide and keeps the transcript attached "
            "to the structure of the deck. That means feedback can point to the moment when "
            "a speaker rushed, repeated setup, or skipped the reason a slide mattered."
        ),
    },
    {
        "slide_object_id": "slide-003",
        "chunk_started_at_ms": 106000,
        "chunk_ended_at_ms": 184000,
        "transcript": (
            "The audience vignette is the important layer. A first year student, a hiring manager, "
            "and a technical reviewer would each listen for different things. The model reads the "
            "transcript from that audience role and answers what they learned, what felt memorable, "
            "where they wanted more time, and what disconnected them."
        ),
    },
    {
        "slide_object_id": "slide-004",
        "chunk_started_at_ms": 184000,
        "chunk_ended_at_ms": 242000,
        "transcript": (
            "After the talk, the presenter can add one or more audience descriptions and compare "
            "scores across takeaway, priorities, engagement, and accessibility. The goal is not just "
            "a grade. It is a practical coaching loop that helps the next version of the talk fit "
            "the people in the room."
        ),
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
        session.flush()
        _seed_transcript_chunks(session, presentation)
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

    from backend.persistence.models import WorkflowNode

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

    from backend.persistence.models import WorkflowNode

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


def _seed_transcript_chunks(session, presentation):
    slide_by_object_id = {slide.google_object_id: slide for slide in presentation.slides}

    session.execute(
        delete(PresentationTranscriptChunk).where(
            PresentationTranscriptChunk.presentation_id == presentation.id
        )
    )

    for chunk_payload in MOCK_TRANSCRIPT_CHUNKS:
        slide = slide_by_object_id.get(chunk_payload["slide_object_id"])
        if slide is None:
            continue

        session.add(
            PresentationTranscriptChunk(
                presentation_id=presentation.id,
                slide_id=slide.id,
                chunk_started_at_ms=chunk_payload["chunk_started_at_ms"],
                chunk_ended_at_ms=chunk_payload["chunk_ended_at_ms"],
                transcript=chunk_payload["transcript"],
                extra_data={"source": "seed_mock_presentation"},
            )
        )


if __name__ == "__main__":
    main()
