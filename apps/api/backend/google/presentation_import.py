from __future__ import annotations

from backend.google.presentation_ingest import ingest_google_slides_presentation
from backend.google.slides_client import GoogleSlidesClient
from backend.persistence.models import Presentation


async def import_google_slides_presentation(
    session,
    presentation_id: str,
    slides_client: GoogleSlidesClient,
) -> Presentation:
    presentation_payload = await slides_client.fetch_presentation(presentation_id)
    presentation = ingest_google_slides_presentation(
        session=session,
        presentation_payload=presentation_payload,
    )
    session.commit()
    session.refresh(presentation)
    return presentation
