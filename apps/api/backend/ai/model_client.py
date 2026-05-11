from __future__ import annotations

import json
import os
import re
from pathlib import Path
from textwrap import dedent
from typing import Any

from dotenv import load_dotenv

API_ROOT = Path(__file__).resolve().parents[2]

load_dotenv(API_ROOT / ".env")

DEFAULT_MODEL = "gpt-4o-mini"

FEEDBACK_PROMPT = dedent(
    """
    You are the live decision engine for a presentation feedback app.

    Decide whether the presenter has satisfied any configured goals for the
    current slide, using only the transcript window for this slide. The window
    grows as more speech arrives, so leave a goal incomplete unless there is
    clear evidence in the provided transcript.

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
    - Preserve completed goals as completed when the payload says they are already complete.
    - Never invent transcript evidence.
    - Keep messages concise and useful during a live talk.
    """
).strip()


class ModelClient:
    """OpenAI-compatible feedback decision client."""

    async def generate_feedback(self, presentation_context: dict[str, Any]) -> dict[str, Any]:
        from langchain_openai import ChatOpenAI

        api_key = _resolve_openai_api_key()
        model_name = str(presentation_context.get("model") or DEFAULT_MODEL)
        model = ChatOpenAI(
            model=model_name,
            temperature=0.1,
            api_key=api_key,
            model_kwargs={"response_format": {"type": "json_object"}},
        )

        result = await model.ainvoke(
            [
                {"role": "system", "content": FEEDBACK_PROMPT},
                {
                    "role": "user",
                    "content": json.dumps(presentation_context, ensure_ascii=True),
                },
            ]
        )
        text = _extract_text(result)
        return _parse_json(text)


def _resolve_openai_api_key() -> str:
    env_key = os.getenv("OPENAI_API_KEY", "").strip()
    if env_key:
        return env_key

    raise RuntimeError("OpenAI API key is missing. Set OPENAI_API_KEY in apps/api/.env.")


def _extract_text(result: Any) -> str:
    content = getattr(result, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                chunks.append(item["text"])
            elif isinstance(item, str):
                chunks.append(item)
        return "\n".join(chunks)
    return str(content)


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
