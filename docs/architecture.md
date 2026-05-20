# Architecture Overview

## Summary

RT Presentation Feedback is a React + FastAPI application that helps presenters import Google Slides decks, configure slide-level goals, and receive private feedback during a live presentation.

The project is a monorepo with:

- `apps/web`: React + Vite frontend.
- `apps/api`: FastAPI backend.
- `apps/api/supabase`: local Supabase migrations and seed support.
- `infra`: local demo stack scripts, Docker assets, and environment notes.
- `packages`: shared contracts and prompt assets reserved for future reuse.
- `references`: external examples and vendored/reference code used during development.

The app is currently a modular monolith. The API owns auth handoff, persistence, Google integration, transcription orchestration, and LLM calls. The web app owns the user experience and calls explicit HTTP endpoints.

## Current Runtime Components

### Frontend

The web app is in `apps/web` and uses React, Vite, React Router, and MUI.

Main routes:

- `/`: workflow library home screen.
- `/builder/:deckId`: slide builder schema editor for a linked presentation.
- `/presentation-schema`: presenter mode for the first linked presentation found in the workflow tree.
- `/presentation-schema/:deckId`: presenter mode for a specific linked presentation.
- `/presentation-schema/:deckId?mode=slide`: slide-only window opened from presenter mode.

Primary frontend areas:

- `pages/Home.jsx`: workflow tree, folder/file management, Google Slides import entry point, and navigation into builder mode.
- `pages/BuilderSchema.jsx`: slide navigator, notes editing, demo transcript recording, builder schema generation, and schema save flow.
- `pages/PresentationSchema.jsx`: presenter workspace, slide-only window coordination, microphone capture, chunk upload, and feedback decision polling.
- `components/PresenterWorkspace.jsx`: presenter mode layout and controls.
- `components/PresenterFeedbackPanel.jsx`: feedback display for timing, goals, accessibility checks, and transcript state.
- `services/*`: small API clients around workflow, builder, and transcription endpoints.

### Backend

The API is in `apps/api` and uses FastAPI, SQLAlchemy, Pydantic, httpx, and LangChain's OpenAI integration.

Main backend areas:

- `backend/main.py`: FastAPI app, CORS, route registration, and health check.
- `backend/routes/auth.py`: local Google OAuth flow, session cookie, logout, and debug/session endpoints.
- `backend/routes/google.py`: direct Google presentation fetch endpoint for authenticated sessions.
- `backend/routes/presentations.py`: workflow tree, Google import, builder schema reads/writes, speaker note refresh, demo transcript storage, LLM builder generation, and feedback decisions.
- `backend/routes/transcription.py`: one-off transcription, chunk transcription with persistence, and transcript cleanup.
- `backend/google`: Google Slides API client, ingestion, and normalized Google schemas.
- `backend/persistence`: SQLAlchemy database models and workflow tree persistence helpers.
- `backend/ai/model_client.py`: prompt definitions and JSON-only OpenAI calls for builder schema and feedback decisions.
- `backend/transcription/asr_transcriber.py`: local Whisper HTTP service client.

### Database

Local persistence uses Supabase Postgres through SQLAlchemy.

Important persisted concepts:

- Workflow nodes for folders/files in the app library.
- Presentations imported from Google.
- Slides and raw Google slide payload/context.
- Slide priority items and pain points.
- Slide demo transcripts.
- Live presentation transcript chunks.

Migrations live in `apps/api/supabase/migrations`.

## Current Data Flow

### Import and Build Flow

1. User signs in with Google.
2. User creates a file from a Google Slides presentation ID in the home workflow library.
3. Backend fetches the deck through Google Slides and persists the presentation/slides locally.
4. User opens `/builder/:deckId`.
5. Frontend loads `GET /api/presentations/{deckId}/builder-schema`.
6. User edits priority items, timing goals, accessibility checks, speaker notes, and demo transcript.
7. Speaker notes can be saved back to Google.
8. Builder schema changes are saved locally.
9. LLM generation can produce or refresh slide goals from slide context, notes, and demo transcript.

### Presenter Flow

1. User launches presenter mode from the builder.
2. The app opens a slide-only window and navigates the current tab to presenter mode.
3. Slide selection is mirrored across tabs through `localStorage`.
4. User starts the presenter timer.
5. Browser microphone capture records short audio windows.
6. Each chunk is posted to the transcription route with presentation ID, slide ID, and elapsed timing.
7. Backend transcribes the chunk through the local Whisper service and stores it.
8. Frontend requests a feedback decision for the active slide.
9. Backend gathers recent transcript chunks, slide build data, slide context, and prior completion state.
10. LLM feedback updates goals, accessibility checks, timing state, and presenter-facing messages.
11. Updated slide data is returned to the frontend and rendered in the feedback panel.
12. Transcript chunks are deleted when the presenter leaves or requests cleanup.

## Provider Strategy

Third-party dependencies are wrapped behind local modules:

- Google APIs are isolated under `backend/google` and auth helpers.
- Speech-to-text is isolated behind `ASRTranscriber`.
- LLM calls are isolated behind `ModelClient`.

This keeps route handlers readable and gives the team a path to swap providers later without reshaping the frontend contract.

## Current Real-Time Boundary

The current implementation uses HTTP polling/request cycles rather than WebSocket or SSE:

- The browser uploads a transcript chunk.
- The backend stores it and returns chunk metadata.
- The browser asks for a feedback decision.
- The backend returns an updated slide and decision summary.

The event catalog still documents the intended real-time vocabulary. A future WebSocket or SSE layer should reuse those concepts rather than inventing a separate feedback language.

## Guiding Rules

- Keep provider SDK details out of frontend code.
- Keep route handlers thin where possible, and move repeated business rules into persistence/provider helpers as they stabilize.
- Preserve API response shapes consumed by `apps/web/src/services`.
- Prefer deterministic normalization around LLM output. The current backend validates IDs, caps text lengths, preserves completed goals, and limits frontend updates.
- Keep demo-specific local setup documented in `infra` so onboarding does not depend on one person's terminal history.
