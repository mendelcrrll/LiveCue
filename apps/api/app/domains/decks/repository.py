from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.decks.google_slides import (
    GoogleSlidesPresentationInput,
    SlideEnrichmentInput,
    SlidePainPointInput,
    SlidePriorityItemInput,
)
from app.domains.decks.models import (
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
            presentation = Presentation(google_presentation_id=payload.presentationId, title=payload.title)
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
            slide.raw_page = slide_payload.model_dump(mode="python")
            slide.priority_items = _build_priority_items(
                enrichment.priority_queue if enrichment is not None else []
            )
            slide.pain_points = _build_pain_points(
                enrichment.pain_points if enrichment is not None else []
            )
            updated_slides.append(slide)

        presentation.slides = updated_slides
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
