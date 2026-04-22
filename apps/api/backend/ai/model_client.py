from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class ModelClient:
    """Placeholder for the OpenAI-compatible model integration."""

    def generate_feedback(self, presentation_context: Mapping[str, Any]) -> Mapping[str, Any]:
        raise NotImplementedError("The model integration is not implemented yet.")
