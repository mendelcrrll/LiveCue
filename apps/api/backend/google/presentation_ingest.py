from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from sqlalchemy.orm import Session

from backend.google.schemas import GoogleSlidesPresentationInput, SlideEnrichmentInput
from backend.persistence.models import Presentation
from backend.persistence.presentations import PresentationRepository


def ingest_google_slides_presentation(
    session: Session,
    presentation_payload: Mapping[str, Any] | GoogleSlidesPresentationInput,
    slide_enrichments: Iterable[Mapping[str, Any] | SlideEnrichmentInput] | None = None,
) -> Presentation:
    normalized_presentation = (
        presentation_payload
        if isinstance(presentation_payload, GoogleSlidesPresentationInput)
        else GoogleSlidesPresentationInput.model_validate(presentation_payload)
    )

    normalized_enrichments = [
        enrichment
        if isinstance(enrichment, SlideEnrichmentInput)
        else SlideEnrichmentInput.model_validate(enrichment)
        for enrichment in (slide_enrichments or [])
    ]

    return PresentationRepository(session).upsert_google_presentation(
        payload=normalized_presentation,
        slide_enrichments=normalized_enrichments,
    )
