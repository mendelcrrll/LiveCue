from __future__ import annotations

from app.domains.decks.models import Presentation
from app.providers.google.slides_client import GoogleSlidesClient
from app.services.google_integration.presentation_ingest import ingest_google_slides_presentation


def import_google_slides_presentation(
    session,
    presentation_id: str,
    slides_client: GoogleSlidesClient | None = None,
) -> Presentation:
    client = slides_client or GoogleSlidesClient()
    presentation_payload = client.fetch_presentation(presentation_id)
    presentation = ingest_google_slides_presentation(
        session=session,
        presentation_payload=presentation_payload,
    )
    session.commit()
    session.refresh(presentation)
    return presentation
