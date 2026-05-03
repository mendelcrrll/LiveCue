# Backend

This workspace contains the Python FastAPI backend for RT Presentation Feedback.

## Structure

- `backend/main.py`: FastAPI app entrypoint
- `backend/routes`: HTTP endpoints used by the web app
- `backend/schemas`: request and response models
- `backend/config.py`: environment-based settings
- `backend/database.py`: SQLAlchemy engine, base model, and sessions
- `backend/persistence`: database models, repositories, and workflow tree persistence
- `backend/google`: Google Slides API integration and Google payload ingestion
- `backend/ai`: model integration placeholder for feedback generation
- `backend/transcription`: ASR transcription placeholder
- `backend/auth`: authentication placeholder
- `supabase`: local Supabase config, migrations, SQL seed file, and mock seed script

## Setup

From `apps/api`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .[dev]
```

MacOS:
``` 
    cd apps/api
    python3 -m venv .venv
    source .venv/bin/activate
    python -m pip install -U pip
    python -m pip install -e ".[dev]"
```

## Run The Backend

From `apps/api`:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload
```
MacOS:
```
    python -m uvicorn backend.main:app --reload 
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

The backend defaults to the local Supabase Postgres URL:

```text
postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres
```

## Seed Mock Data

From `apps/api`:

```powershell
.\.venv\Scripts\python.exe supabase\seed_mock_presentation.py
```

## Current Endpoints

- `GET /health`
- `GET /api/presentations/tree`
- `POST /api/presentations/import`
- `POST /api/presentations/folders`
- `POST /api/presentations/files`
- `DELETE /api/presentations/nodes/{node_id}`

The Google Slides API client is still a stub in `backend/google/slides_client.py`.
## Google OAuth
test google auth login: http://127.0.0.1:8000/api/auth/google/login
