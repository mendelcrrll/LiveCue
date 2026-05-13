from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.google.schemas import (
    GoogleSlidesPresentationInput,
    SlideEnrichmentInput,
    SlidePainPointInput,
    SlidePriorityItemInput,
)
from backend.persistence.models import (
    Presentation,
    PresentationSlide,
    SlidePainPoint,
    SlidePriorityItem,
)


class PresentationRepository:
    def __init__(self, session: Session):
        self.session = session

    def upsert_google_presentation(
        self,
        payload: GoogleSlidesPresentationInput,
        slide_enrichments: Iterable[SlideEnrichmentInput] | None = None,
    ) -> Presentation:
        enrichment_map = {
            enrichment.slide_object_id: enrichment for enrichment in (slide_enrichments or [])
        }

        presentation = self.session.scalar(
            select(Presentation).where(
                Presentation.google_presentation_id == payload.presentationId,
            )
        )

        if presentation is None:
            presentation = Presentation(
                google_presentation_id=payload.presentationId,
                title=payload.title,
            )
            self.session.add(presentation)

        presentation.title = payload.title
        presentation.locale = payload.locale
        presentation.revision_id = payload.revisionId
        presentation.page_width = _read_size_value(payload, "width")
        presentation.page_height = _read_size_value(payload, "height")
        presentation.page_unit = _read_size_unit(payload)
        presentation.raw_payload = payload.model_dump(mode="python")

        existing_slides = {slide.google_object_id: slide for slide in presentation.slides}
        updated_slides: list[PresentationSlide] = []

        for slide_index, slide_payload in enumerate(payload.slides):
            slide = existing_slides.get(slide_payload.objectId)
            if slide is None:
                slide = PresentationSlide(google_object_id=slide_payload.objectId)

            enrichment = enrichment_map.get(slide_payload.objectId)
            slide.slide_index = slide_index
            slide.page_type = slide_payload.pageType
            slide.time_per_slide_seconds = (
                enrichment.time_per_slide_seconds if enrichment is not None else None
            )
            raw_page = slide_payload.model_dump(mode="python")
            slide.raw_page = _add_readable_slide_context(raw_page, slide_index=slide_index)
            updated_slides.append(slide)

        presentation.slides = updated_slides
        self.session.flush()

        for slide in updated_slides:
            slide.priority_items.clear()
            slide.pain_points.clear()

        self.session.flush()

        for slide in updated_slides:
            enrichment = enrichment_map.get(slide.google_object_id)
            slide.priority_items = _build_priority_items(
                enrichment.priority_queue if enrichment is not None else []
            )
            slide.pain_points = _build_pain_points(
                enrichment.pain_points if enrichment is not None else []
            )

        self.session.flush()
        return presentation


def _read_size_value(payload: GoogleSlidesPresentationInput, attribute: str) -> float | None:
    if payload.pageSize is None:
        return None

    dimension = getattr(payload.pageSize, attribute, None)
    return dimension.magnitude if dimension is not None else None


def _read_size_unit(payload: GoogleSlidesPresentationInput) -> str | None:
    if payload.pageSize is None:
        return None

    for attribute in ("width", "height"):
        dimension = getattr(payload.pageSize, attribute, None)
        if dimension is not None and dimension.unit is not None:
            return dimension.unit
    return None


def _build_priority_items(
    items: list[SlidePriorityItemInput],
) -> list[SlidePriorityItem]:
    return [
        SlidePriorityItem(
            priority_rank=item.priority_rank,
            title=item.title,
            notes=item.notes,
            extra_data=item.extra_data,
        )
        for item in items
    ]


def _build_pain_points(
    items: list[SlidePainPointInput],
) -> list[SlidePainPoint]:
    return [
        SlidePainPoint(
            label=item.label,
            severity=item.severity,
            details=item.details,
            extra_data=item.extra_data,
        )
        for item in items
    ]


def _add_readable_slide_context(raw_page: dict[str, Any], *, slide_index: int) -> dict[str, Any]:
    text_blocks = _extract_page_text_blocks(raw_page)
    speaker_notes = _extract_speaker_notes(raw_page)
    image_descriptions = _extract_image_descriptions(raw_page)

    enriched = dict(raw_page)
    enriched["slideText"] = text_blocks
    enriched["speakerNotes"] = speaker_notes
    enriched["imageDescriptions"] = image_descriptions
    enriched["title"] = _infer_slide_title(text_blocks, slide_index=slide_index)
    return enriched


def _extract_page_text_blocks(page: dict[str, Any]) -> list[str]:
    return _dedupe_preserving_order(
        text
        for element in page.get("pageElements", [])
        for text in _extract_element_text_blocks(element)
        if text
    )


def _extract_element_text_blocks(element: dict[str, Any]) -> list[str]:
    blocks: list[str] = []

    shape_text = _extract_text_content(element.get("shape", {}).get("text"))
    if shape_text:
        blocks.append(shape_text)

    table = element.get("table") or {}
    for row in table.get("tableRows", []):
        cell_text = [
            _extract_text_content(cell.get("text"))
            for cell in row.get("tableCells", [])
            if _extract_text_content(cell.get("text"))
        ]
        if cell_text:
            blocks.append(" | ".join(cell_text))

    group = element.get("elementGroup") or {}
    for child in group.get("children", []):
        blocks.extend(_extract_element_text_blocks(child))

    return blocks


def _extract_text_content(text_content: dict[str, Any] | None) -> str:
    if not text_content:
        return ""

    parts = [
        text_run.get("content", "")
        for item in text_content.get("textElements", [])
        if isinstance(text_run := item.get("textRun"), dict)
    ]
    return _normalize_text("".join(parts))


def _extract_speaker_notes(page: dict[str, Any]) -> str:
    notes_page = (page.get("slideProperties") or {}).get("notesPage") or {}
    notes_blocks = []

    for element in notes_page.get("pageElements", []):
        shape = element.get("shape") or {}
        placeholder = shape.get("placeholder") or {}
        text = _extract_text_content(shape.get("text"))
        if text and (placeholder.get("type") == "BODY" or not placeholder):
            notes_blocks.append(text)

    return "\n".join(_dedupe_preserving_order(notes_blocks))


def _extract_image_descriptions(page: dict[str, Any]) -> list[str]:
    descriptions: list[str] = []
    for element in page.get("pageElements", []):
        descriptions.extend(_extract_element_image_descriptions(element))
    return _dedupe_preserving_order(descriptions)


def _extract_element_image_descriptions(element: dict[str, Any]) -> list[str]:
    descriptions: list[str] = []
    if element.get("image") is not None:
        title = _normalize_text(str(element.get("title") or ""))
        description = _normalize_text(str(element.get("description") or ""))
        if title and description:
            descriptions.append(f"{title}: {description}")
        elif title or description:
            descriptions.append(title or description)

    group = element.get("elementGroup") or {}
    for child in group.get("children", []):
        descriptions.extend(_extract_element_image_descriptions(child))

    return descriptions


def _infer_slide_title(text_blocks: list[str], *, slide_index: int) -> str:
    if not text_blocks:
        return f"Slide {slide_index + 1}"
    return text_blocks[0][:120]


def _normalize_text(value: str) -> str:
    return " ".join(value.replace("\u000b", "\n").split())


def _dedupe_preserving_order(values: Iterable[str]) -> list[str]:
    seen = set()
    deduped = []
    for value in values:
        normalized = _normalize_text(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            deduped.append(normalized)
    return deduped
