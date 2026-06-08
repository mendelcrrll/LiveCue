from __future__ import annotations

import time
from collections.abc import Mapping
from typing import Any

from backend.google.presentation_ingest import ingest_google_slides_presentation
from backend.google.slides_client import GoogleSlidesClient
from backend.persistence.models import Presentation


async def import_google_slides_presentation(
    session,
    presentation_id: str,
    slides_client: GoogleSlidesClient,
) -> Presentation:
    presentation_payload = await slides_client.fetch_presentation(presentation_id)
    presentation_payload = await _add_slide_thumbnails(
        presentation_payload=presentation_payload,
        slides_client=slides_client,
    )
    presentation = ingest_google_slides_presentation(
        session=session,
        presentation_payload=presentation_payload,
    )
    session.commit()
    session.refresh(presentation)
    return presentation


async def _add_slide_thumbnails(
    presentation_payload: Mapping[str, Any],
    slides_client: GoogleSlidesClient,
) -> dict[str, Any]:
    enriched_payload = dict(presentation_payload)
    slides = []

    for slide_payload in presentation_payload.get("slides", []):
        slide = dict(slide_payload)
        slide_object_id = slide.get("objectId")

        if slide_object_id:
            thumbnail_payload = await slides_client.fetch_slide_thumbnail(
                presentation_id=presentation_payload["presentationId"],
                slide_object_id=slide_object_id,
            )
            thumbnail_url = thumbnail_payload.get("contentUrl")

            if thumbnail_url:
                slide["thumbnailUrl"] = thumbnail_url
                slide.setdefault("imageUrl", thumbnail_url)
                slide["thumbnailRefreshedAt"] = int(time.time())

        slides.append(slide)

    enriched_payload["slides"] = slides
    return enriched_payload
