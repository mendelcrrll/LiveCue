# Infrastructure

`infra` contains local development and demo support for RT Presentation Feedback.

The project does not currently have production deployment infrastructure. The files here are focused on making the local demo stack repeatable for the team.

## Layout

```text
infra/
  docker/
    compose.whisper.yml        Runs the local whisper.cpp HTTP service.
    whisper.Dockerfile         Builds the rt-whisper:local image from references/whisper.cpp.
  env/
    README.md                  Environment variable documentation.
  scripts/
    start-demo.ps1             Starts Supabase, Whisper, FastAPI, and Vite.
    stop-demo.ps1              Stops processes started by start-demo.ps1.
```

## Demo Stack

The integrated local demo uses:

- Supabase local Postgres for persistence.
- FastAPI backend on `http://127.0.0.1:8000`.
- Vite frontend on `http://127.0.0.1:5173`.
- Local Whisper HTTP service on `http://127.0.0.1:8081`.
- Google OAuth for deck import and speaker note sync.
- OpenAI-compatible chat model calls for schema generation and feedback decisions.

## Start The Demo

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1
```

The script opens separate PowerShell windows for the long-running services and stores their process IDs in `.tmp/demo-processes.json`.

Use this after changing the Whisper Dockerfile:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1 -RebuildWhisper
```

## Stop The Demo

If the start script is still waiting, press Enter in that window.

Or run:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\stop-demo.ps1
```

## First-Run Requirements

- Node/npm installed.
- Python 3.12 or newer.
- Docker Desktop running.
- Supabase CLI available through `npx supabase`.
- Backend virtualenv created at `apps/api/.venv`.
- Whisper model downloaded to `references/whisper.cpp/models/ggml-base.en.bin`.
- `apps/api/.env` configured for Google and OpenAI where needed.

## Local Ports

- Web: `5173`
- API: `8000`
- Whisper host port: `8081`
- Supabase API: `54331`
- Supabase Postgres: `54332`

Keep these ports stable while demoing because CORS, redirect URIs, and scripts assume them.
