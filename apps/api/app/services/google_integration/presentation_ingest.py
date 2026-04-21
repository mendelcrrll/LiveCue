from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from sqlalchemy.orm import Session

from app.domains.decks.google_slides import GoogleSlidesPresentationInput, SlideEnrichmentInput
from app.domains.decks.models import Presentation
from app.domains.decks.repository import PresentationRepository


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
