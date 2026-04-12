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
2. Activate it in PowerShell: `.\\.venv\\Scripts\\Activate.ps1`
3. Install the package and dev tools: `pip install -e .[dev]`

## Notes

- `uv` was not available in the current environment, so this setup uses a standard `pyproject.toml` that works with `pip` today and can still be used with `uv` later.
- Keep secrets out of the repo. Use environment variables or an untracked local env file.
