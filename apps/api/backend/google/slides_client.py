from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class GoogleSlidesClient:
    def fetch_presentation(self, presentation_id: str) -> Mapping[str, Any]:
        raise NotImplementedError(
            "Google Slides import is scaffolded, but the Google provider is not implemented yet."
        )
