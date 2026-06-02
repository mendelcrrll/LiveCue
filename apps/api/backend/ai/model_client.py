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

POST_FEEDBACK_PROMPT = dedent(
    """
    You are the post-presentation coach for a presentation feedback app.

    Read the full presentation transcript, slide context, and saved audience
    vignettes. Role-play the audience members described by those vignettes and
    evaluate the talk from their perspective. If multiple vignettes are present,
    synthesize where they agree and call out meaningful differences inside the
    feedback text.

    Return JSON only. Do not wrap it in markdown.

    Required schema:
    {
      "overallScore": 0,
      "summary": "short presenter-facing synthesis",
      "themes": [
        {
          "id": "audienceTakeaway|contentPriorities|engagementConnection|accessibilityDelivery",
          "title": "Audience Takeaway",
          "score": 0,
          "summary": "theme-level synthesis",
          "criteria": [
            {
              "label": "short criterion label",
              "score": 0,
              "feedback": "specific feedback grounded in transcript evidence and audience vignette"
            }
          ]
        }
      ]
    }

    Theme definitions and source questions:
    - audienceTakeaway: how the audience plans to use what they learned, what
      they now know, what problem the talk tried to solve, and who benefits most.
    - contentPriorities: where to spend more or less time, what else the audience
      wanted to know, what section to cut, and the most memorable point or slide.
    - engagementConnection: three words describing the presenter, what connected
      or disconnected them, and when they felt most or least engaged.
    - accessibilityDelivery: whether language, visuals, structure, and delivery
      were accessible for the described audience. Focus on plain language,
      verbal descriptions of visuals, cognitive load, pacing, and signposting.

    Rules:
    - Include exactly the four theme ids above.
    - Give each theme 3 to 5 criteria.
    - Scores are integers from 0 to 100.
    - Do not invent facts. When transcript evidence is missing, say what cannot
      be judged and score conservatively.
    - Accessibility must be one of the four themes.
    - Do not evaluate body language; this app does not capture reliable body
      language evidence.
    - Keep each criterion feedback concise and actionable.
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

    async def generate_post_feedback(self, presentation_context: dict[str, Any]) -> dict[str, Any]:
        return await self._generate_json(prompt=POST_FEEDBACK_PROMPT, context=presentation_context)

    async def _generate_json(self, *, prompt: str, context: dict[str, Any]) -> dict[str, Any]:
        import httpx
        from backend.config import get_settings

        settings = get_settings()

        llm_provider = (settings.llm_provider or "").strip().lower()
        use_openai = (
            llm_provider == "openai"
            or settings.inference_llm_model_name.strip().lower() == "openai"
        )

        if use_openai:
          from langchain_openai import ChatOpenAI
          api_key = _resolve_openai_api_key(settings.openai_api_key)
          configured_model = settings.inference_llm_model_name.strip()
          model_name = str(
              context.get("model")
              or (
                  DEFAULT_MODEL
                  if configured_model.lower() == "openai"
                  else configured_model
              )
              or DEFAULT_MODEL
          )
          model = ChatOpenAI(
              model=model_name,
              temperature=0.35,
              api_key=api_key,
              model_kwargs={"response_format": {"type": "json_object"}},
          )

          result = await model.ainvoke(
              [
                  {"role": "system", "content": prompt},
                  {
                      "role": "user",
                      "content": json.dumps(context, ensure_ascii=True),
                  },
              ]
          )
          text = _extract_text(result)
        else:
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
                  "temperature": 0.35,
                  "num_predict": 512,
              },
          }

          async with httpx.AsyncClient(timeout=300.0) as client:
              response = await client.post(
                  f"{settings.ollama_base_url}/api/chat",
                  json=payload,
              )
              if response.status_code != 200:
                  raise RuntimeError(
                      f"Ollama {response.status_code}: {response.text[:400]}"
                  )

          data = response.json()
          ollama_error = data.get("error")
          if ollama_error:
              raise RuntimeError(f"Ollama error: {ollama_error}")
          text = data.get("message", {}).get("content", "")
        return _parse_json(text)
    
def _resolve_openai_api_key(settings_key: str = "") -> str:
    env_key = (settings_key or os.getenv("OPENAI_API_KEY", "")).strip()
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
