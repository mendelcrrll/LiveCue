# Backend API

`apps/api` contains the FastAPI backend for RT Presentation Feedback.

## Stack

- FastAPI
- SQLAlchemy
- Pydantic / Pydantic Settings
- Supabase local Postgres
- httpx
- LangChain OpenAI integration
- Local `whisper.cpp` HTTP service for speech-to-text

## Structure

```text
backend/
  main.py                         FastAPI app, CORS, route registration, health check.
  config.py                       Environment-backed settings from apps/api/.env.
  database.py                     SQLAlchemy engine, base model, and sessions.
  routes/
    auth.py                       Google OAuth, session cookie, logout, debug/session endpoints.
    google.py                     Direct authenticated Google presentation fetch.
    presentations.py              Workflow tree, import, builder schema, generation, feedback decisions.
    transcription.py              Audio transcription, live chunk persistence, cleanup.
  schemas/
    presentations.py              Pydantic request/response models for builder and feedback.
    workflow.py                   Workflow node request/response models.
  persistence/
    models.py                     SQLAlchemy models.
    workflow_tree.py              Workflow tree CRUD.
    presentations.py              Presentation context helpers.
  google/
    slides_client.py              Google Slides HTTP client.
    presentation_import.py        Google deck import flow.
    presentation_ingest.py        Normalization into local persistence.
    schemas.py                    Google payload schemas.
  ai/
    model_client.py               Builder schema and feedback prompts plus OpenAI JSON calls.
  transcription/
    asr_transcriber.py            Whisper HTTP client.
supabase/
  migrations/                     Local database schema.
  seed.sql                        SQL seed support.
  seed_mock_presentation.py       Mock presentation seed helper.
```

## Setup

From `apps/api`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -U pip
.\.venv\Scripts\python.exe -m pip install -e .[dev]
```

Create `apps/api/.env`. See `infra/env/README.md` for the current variable list.

## Run

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```

Health check:

```text
http://127.0.0.1:8000/health
```

## Local Supabase

From `apps/api/supabase`:

```powershell
npx supabase start
npx supabase db reset --local
```

The backend default database URL is:

```text
postgresql+psycopg://postgres:postgres@127.0.0.1:54332/postgres
```

## Seed Mock Data

From `apps/api`:

```powershell
.\.venv\Scripts\python.exe supabase\seed_mock_presentation.py
```

## Current Endpoint Areas

Health:

- `GET /health`

Auth:

- `GET /api/auth/google/login`
- `GET /api/auth/google/callback`
- `GET /api/auth/session`
- `GET /api/auth/debug/session`
- `POST /api/auth/logout`

Google:

- `GET /api/google/presentations/{presentation_id}`

Workflow and presentations:

- `GET /api/presentations/tree`
- `POST /api/presentations/folders`
- `POST /api/presentations/files`
- `DELETE /api/presentations/nodes/{node_id}`
- `POST /api/presentations/import`
- `GET /api/presentations/{presentation_id}/builder-schema`
- `PUT /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}`
- `PUT /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}/notes`
- `PUT /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}/demo-transcript`
- `POST /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}/generate`
- `POST /api/presentations/{presentation_id}/refresh-google-context`
- `GET /api/presentations/{presentation_id}/slides/{slide_id}/thumbnail`
- `POST /api/presentations/{presentation_id}/slides/{slide_id}/feedback-decision`

Transcription:

- `POST /api/transcription/transcribe`
- `POST /api/transcription/chunks`
- `DELETE /api/transcription/presentations/{presentation_id}/chunks`

Detailed contract notes live in `docs/api-contracts.md`.

## External Services

Google OAuth and Slides:

- Used for sign-in, deck import, thumbnail refresh, and speaker note writeback.
- Requires Google client ID/secret/redirect URI in `apps/api/.env`.

OpenAI:

- Used by `ModelClient` for builder schema generation and live feedback decisions.
- Requires `OPENAI_API_KEY`.
- Default model in code is `gpt-4o-mini`.

Whisper:

- `ASRTranscriber` calls `POST {WHISPER_BASE_URL}/inference`.
- Default base URL is `http://127.0.0.1:8081`.
- The local demo stack runs this through Docker using `infra/docker/compose.whisper.yml`.

## Checks

```powershell
cd apps/api
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest
```

## Notes For Contributors

- Keep provider details in `backend/google`, `backend/ai`, and `backend/transcription`.
- Keep frontend-facing request/response shapes in `backend/schemas`.
- `routes/presentations.py` is currently large because it owns several demo-critical flows. When refactoring, preserve endpoint behavior and move helpers into focused service modules.
- Avoid committing `.env`, Supabase temp state, downloaded models, or generated local files.
