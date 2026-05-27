from __future__ import annotations

import json
import re
from pathlib import Path
from textwrap import dedent
from typing import Any

API_ROOT = Path(__file__).resolve().parents[2]

FEEDBACK_PROMPT = dedent(
    """
    You are the live decision engine for a presentation feedback app.

    Decide whether the presenter has satisfied any configured goals for the
    current slide, using the transcript window plus the slide text, speaker
    notes, optional demo transcript, neighboring slide summaries, configured
    goals, and accessibility checks. The transcript window grows as more speech
    arrives, so leave a goal incomplete unless there is clear evidence in the
    provided transcript.

    Also evaluate enabled accessibility goals. Mark them:
    - "satisfied" when the transcript clearly shows the presenter did it.
    - "attention" when the transcript suggests the presenter may have missed it.
    - "pending" when there is not enough evidence yet.

    Return JSON only. Do not wrap it in markdown.

    Required schema:
    {
      "summary": "short presenter-facing summary",
      "goalUpdates": [
        {
          "id": "priority item id",
          "completed": true,
          "evidence": "brief quote or paraphrase from the transcript",
          "confidence": 0.0
        }
      ],
      "accessibilityUpdates": [
        {
          "id": "accessibility check id",
          "status": "pending|satisfied|attention",
          "evidence": "brief evidence",
          "confidence": 0.0
        }
      ],
      "timing": {
        "status": "on_track|over_time|under_time|unknown",
        "message": "short timing note"
      },
      "frontendUpdates": [
        {
          "kind": "goal|accessibility|timing|log",
          "id": "optional affected item id",
          "action": "short machine-readable action",
          "message": "short presenter-facing message"
        }
      ]
    }

    Rules:
    - Only include goalUpdates for configured priority items.
    - For goals, only emit positive completions. Do not send "not reached" or
      incomplete goal updates.
    - Preserve completed goals as completed when the payload says they are already complete.
    - Never invent transcript evidence.
    - Keep messages concise and useful during a live talk.
    """
).strip()

BUILDER_SCHEMA_PROMPT = dedent(
    """
    You generate a slide-level builder schema for a presentation feedback app.

    Use the slide title, slide text, speaker notes, optional demo transcript,
    image descriptions, nearby slide summaries, and existing builder schema to
    infer what the presenter should accomplish on this slide.

    Return JSON only. Do not wrap it in markdown.

    Required schema:
    {
      "priorityItems": [
        {
          "text": "specific presenter-facing goal",
          "category": "content|transition|demo|accessibility|timing|custom"
        }
      ],
      "timingGoal": {
        "minutes": 1,
        "seconds": 30
      },
      "accessibilityChecks": [
        {
          "id": "existing-or-kebab-id",
          "label": "short check label",
          "enabled": true,
          "severity": "low|medium|high",
          "status": "pending|attention",
          "evidence": "why this may matter for the slide"
        }
      ]
    }

    Rules:
    - Generate 3 to 5 concise presentation goals.
    - Goals should be observable from the presenter's speech.
    - When a demo transcript is provided, treat it as the presenter's intended
      live wording and prefer goals that capture important demo steps,
      explanations, decisions, and transitions in that transcript.
    - Prefer goals that are implied by the notes over generic speaking advice.
    - Estimate timing from the amount and complexity of the content.
    - Keep timing between 20 seconds and 5 minutes.
    - Preserve useful existing accessibility check IDs when possible.
    - Mark accessibility checks enabled when they are likely concerns for this slide.
    - Do not invent facts beyond the slide context.
    """
).strip()


class ModelClient:
    """Local inference client backed by Ollama.

    Ollama must be running and the configured model must be pulled before
    calling these methods.  Start Ollama, then run:
        ollama pull <settings.inference_llm_model_name>
    """

    async def generate_feedback(self, presentation_context: dict[str, Any]) -> dict[str, Any]:
        return await self._generate_json(prompt=FEEDBACK_PROMPT, context=presentation_context)

    async def generate_builder_schema(self, presentation_context: dict[str, Any]) -> dict[str, Any]:
        return await self._generate_json(prompt=BUILDER_SCHEMA_PROMPT, context=presentation_context)

    async def _generate_json(self, *, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        import httpx

        from backend.config import get_settings

        settings = get_settings()

        payload = {
            "model": settings.inference_llm_model_name,
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(context, ensure_ascii=True)},
            ],
            "stream": False,
            "think": False,
            "format": "json",
            "options": {
                "temperature": 0.1,
                "num_predict": 512,
            },
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/chat",
                json=payload,
            )
            response.raise_for_status()

        data = response.json()
        text = data.get("message", {}).get("content", "")
        return _parse_json(text)


def _parse_json(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}

    return parsed if isinstance(parsed, dict) else {}
