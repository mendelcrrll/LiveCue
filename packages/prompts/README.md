# Prompts Package

This package is reserved for reusable prompt assets and evaluation rubrics.

## Current Source Of Truth

The current prompts live in:

```text
apps/api/backend/ai/model_client.py
```

That file contains:

- Builder schema generation prompt.
- Live feedback decision prompt.
- JSON parsing and OpenAI-compatible call wrapper.

## Candidate Future Contents

- Versioned prompt files for builder generation.
- Versioned prompt files for feedback decisions.
- Small fixture contexts for prompt testing.
- Expected JSON output examples.
- Rubrics for evaluating goal completion, accessibility checks, and timing.

## Extraction Guidance

Move prompts here when prompt iteration becomes frequent enough that editing backend code is slowing the team down. Until then, keeping prompts near `ModelClient` makes the current demo path easier to follow.
