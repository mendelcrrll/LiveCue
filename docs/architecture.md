# Architecture Overview

## Summary

RT Presentation Feedback is a web application that helps presenters prepare and deliver Google Slides presentations while receiving live feedback tied to their presentation goals.

The project is organized as a monorepo with:

- a React frontend in `apps/web`
- a Python backend in `apps/api`
- shared contracts and prompts in `packages`
- environment and deployment support in `infra`

## Architectural Direction

The project starts as a modular monolith instead of multiple deployable services.

This keeps setup simple while preserving strong boundaries between:

- frontend user flows
- backend domains
- external providers
- real-time events
- future local model adapters

## Frontend Areas

- `auth`: Google sign-in and session bootstrap
- `deck-library`: list and choose slide decks
- `presentation-builder`: define goals, notes, and feedback preferences
- `live-session`: launch and manage the active presentation session
- `feedback-panel`: display transcript, alerts, and guidance during delivery

## Backend Areas

- `auth`: Google OAuth handoff and session identity
- `decks`: deck listing and retrieval
- `presentation_configs`: saved presenter preferences and goals
- `sessions`: live presentation session lifecycle
- `feedback`: generated alerts, recommendations, and summaries

Supporting backend service areas include:

- `google_integration`
- `transcription`
- `goal_tracking`
- `accessibility_checks`
- `orchestration`

## Provider Strategy

All third-party dependencies should be wrapped in provider interfaces. This lets the project begin with hosted or wrapper-based services and later move to local models without changing core application logic.

Primary provider categories:

- Google APIs
- speech-to-text
- LLM evaluation
- future local model runtime

## Real-Time Flow

The expected live session loop is:

1. The presenter starts a session from the web app.
2. The backend creates a live session context.
3. Audio is transcribed in near real time.
4. Transcript windows are evaluated against goals and accessibility rules.
5. Feedback events are streamed back to the presenter interface.

## Guiding Rules

- Keep route handlers thin.
- Keep business rules in domain or service modules.
- Keep provider SDK logic isolated from the rest of the app.
- Prefer stable event contracts between live-session components.
- Use deterministic rules when possible before escalating to model-based analysis.
