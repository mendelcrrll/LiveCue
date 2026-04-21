# API Workspace

This directory contains the Python backend for the RT Presentation Feedback project.

## Purpose

The backend owns:

- Google authentication handoff and Google Workspace integrations
- presentation session orchestration
- transcription and analysis pipelines
- feedback event generation and streaming

## Structure

- `app/api`: transport layer such as routes, request schemas, and shared dependencies
- `app/core`: configuration, logging, security, and database wiring
- `app/domains`: business logic grouped by product area
- `app/services`: orchestration and cross-domain workflows
- `app/providers`: adapters for external vendors and future local models
- `app/events`: internal event definitions and real-time messaging hooks
- `app/workers`: background processing entry points
- `tests`: unit and integration test suites

## Recommended Local Setup

This scaffold is ready for a FastAPI-based service, but dependencies have not been installed yet.

1. Create a virtual environment: `python -m venv .venv`
2. Install the package and dev tools with the venv Python: `.\\.venv\\Scripts\\python.exe -m pip install -e .[dev]`

## Notes

- `uv` was not available in the current environment, so this setup uses a standard `pyproject.toml` that works with `pip` today and can still be used with `uv` later.
- Keep secrets out of the repo. Use environment variables or an untracked local env file.

## Local Supabase Workflow

This workspace now includes a local Supabase layout under `apps/api/supabase` for Google Slides persistence.

Recommended setup:

1. Install a Docker-compatible runtime such as Docker Desktop.
2. From `apps/api`, start the local stack with `npx supabase start`.
3. Rebuild the local database from migrations with `npx supabase db reset --local`.
4. Point the Python API to the local Postgres instance with `DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres`.

The initial schema stores:

- one row per Google Slides presentation
- one row per slide
- one ordered priority queue per slide
- one or more pain points per slide
- one workflow tree of folders and files for the UI

The Python entrypoint for ingesting a Google Slides payload is `app/services/google_integration/presentation_ingest.py`.
The backend import route scaffold is `POST /api/presentations/import`.

## Run The API

To serve presentation data for the web app:

1. Start the API from `apps/api`: `.\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload`
2. Open `http://127.0.0.1:8000/health` to confirm the service is up.

The frontend reads its presentation tree from `GET /api/presentations/tree`, which now
builds the tree from rows in the local database.

## Seed One Mock Presentation

To insert one simple mock presentation into the local Supabase database:

1. Make sure the local Supabase stack is running.
2. From `apps/api`, run: `.\\.venv\\Scripts\\python.exe scripts\\seed_mock_presentation.py`

This inserts:

- one presentation named `intro-slides.pptx`
- two slides
- one priority item and one pain point per slide
- one workflow tree with `Course Presentations/Demo Folder/intro-slides.pptx`

The script also prints a simple example UI hierarchy:

- `Course Presentations/`
- `Demo Folder/`
- `intro-slides.pptx`

The workflow tree is stored in `workflow_nodes`, so the seeded folder structure is also
persisted in the database.

## Import Route Scaffold

The backend now exposes:

- `POST /api/presentations/import`
- `POST /api/presentations/folders`
- `POST /api/presentations/files`
- `DELETE /api/presentations/nodes/{node_id}`

with a JSON body like:

```json
{
  "presentation_id": "your-google-slides-id"
}
```

This route is wired into the ingestion flow and database write path, but the actual
Google Slides provider is still a stub. The next implementation step is to replace
`app/providers/google/slides_client.py` with a real Google Slides API client.

## Local Migration Note

Because the workflow tree now has its own database table, pull the latest changes into the local
Supabase instance before using the updated UI:

1. `npx supabase db reset --local`
2. `.\\.venv\\Scripts\\python.exe scripts\\seed_mock_presentation.py`
