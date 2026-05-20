# RT Presentation Feedback

RT Presentation Feedback is a local-first demo app for helping presenters prepare and deliver Google Slides presentations with private, real-time feedback.

The current branch, `test-section`, contains the latest demo flow. Treat it as the working reference for the current product state until the team decides how to merge or rename it.

## Current Product State

The app currently supports:

- Google OAuth sign-in and session cookies for local development.
- A workflow library with folders, manual files, and Google Slides imports.
- Google Slides ingestion into a local Supabase Postgres database.
- Slide thumbnails, speaker notes, and readable slide context.
- A builder view where each slide can store priority goals, timing goals, accessibility checks, speaker notes, and a demo transcript.
- LLM-assisted builder schema generation from slide context, speaker notes, and optional demo transcripts.
- A presenter view with slide navigation, timer controls, a private feedback panel, and an optional separate slide-only window.
- Microphone capture in browser, chunked transcription through a local `whisper.cpp` HTTP service, and transcript storage per presentation slide.
- LLM-assisted feedback decisions that update completed goals, accessibility status, timing notes, and presenter-facing feedback.

## Repository Layout

```text
apps/
  api/        FastAPI backend, database models, Supabase migrations, Google integration, transcription routes, LLM feedback logic.
  web/        React + Vite frontend for the workflow library, builder, and presenter views.
docs/         Architecture, user flows, API contracts, events, setup state, and ADRs.
infra/        Local demo scripts, Docker assets, and environment setup notes.
packages/     Shared contracts and prompt assets reserved for cross-app reuse.
references/   Vendored/reference material, including Google Slides examples and whisper.cpp.
```

## Quick Start

Install root JavaScript dependencies:

```powershell
npm install
```

Set up the backend virtual environment:

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install -e .[dev]
```

Create `apps/api/.env` with the values your local flow needs. See `infra/env/README.md` for the current environment variables.

For the full local demo stack, use:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1
```

The script starts Supabase, Whisper, FastAPI, and Vite, then prints the web URL. Use this when preparing for a demo because it matches the current integrated path.

## Manual Development Commands

Run the backend:

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Run the web app:

```powershell
npm --workspace web run dev
```

Run frontend checks:

```powershell
npm --workspace web run lint
npm --workspace web run build
```

Run backend checks:

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

## Main Local URLs

- Web app: `http://127.0.0.1:5173`
- API health check: `http://127.0.0.1:8000/health`
- Google OAuth login: `http://127.0.0.1:8000/api/auth/google/login`
- Auth session status: `http://127.0.0.1:8000/api/auth/session`
- Presentation tree: `http://127.0.0.1:8000/api/presentations/tree`
- Whisper HTTP service: `http://127.0.0.1:8081`

## Documentation Map

- `docs/architecture.md`: current architecture and runtime flow.
- `docs/user-flows.md`: what a presenter does through the app.
- `docs/api-contracts.md`: implemented API endpoints and payload concepts.
- `docs/event-catalog.md`: current event/update shapes and future real-time direction.
- `docs/setup-checklist.md`: completed work and remaining setup/documentation tasks.
- `apps/web/README.md`: frontend-specific structure and commands.
- `apps/api/README.md`: backend-specific structure, setup, endpoints, and services.
- `infra/README.md`: local demo stack and helper scripts.

## Important Notes

- The root `package.json` only defines workspaces. Most web commands run through the `web` workspace.
- The backend reads configuration from `apps/api/.env`.
- Real Google import and note refresh require valid Google OAuth credentials.
- Builder generation and feedback decisions require `OPENAI_API_KEY`.
- Transcription requires the local Whisper service and the `ggml-base.en.bin` model under `references/whisper.cpp/models`.
- Do not commit local secrets, Supabase temp files, downloaded models, or `.tmp` process state.
