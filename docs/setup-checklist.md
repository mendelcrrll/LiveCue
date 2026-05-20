# Setup Checklist

This checklist reflects the current `test-section` branch, which is the branch used for the recent demo.

## Repository

- [x] Create monorepo root.
- [x] Scaffold frontend workspace in `apps/web`.
- [x] Scaffold backend workspace in `apps/api`.
- [x] Add root workspace configuration.
- [x] Add root ignore rules for local environments and secrets.
- [x] Add reference folders for Google Slides examples and Whisper.
- [ ] Add root convenience scripts for common web/api commands.
- [ ] Decide whether `test-section` should be merged, renamed, or kept as a demo branch.

## Documentation

- [x] Add architecture overview.
- [x] Add user flow document.
- [x] Add API contract document.
- [x] Add event catalog.
- [x] Add first ADR.
- [x] Replace placeholder root README with current project documentation.
- [x] Update frontend/backend/infra docs to match the current demo setup.
- [ ] Add screenshots or a short demo walkthrough once the UI is stable.
- [ ] Add troubleshooting notes based on team onboarding issues.

## Backend Setup

- [x] Create Python package layout.
- [x] Add `pyproject.toml`.
- [x] Install FastAPI-oriented dependencies.
- [x] Add SQLAlchemy database layer.
- [x] Add Supabase migrations.
- [x] Add workflow tree persistence.
- [x] Add Google OAuth and Google Slides client integration.
- [x] Add presentation import and builder schema endpoints.
- [x] Add speaker note refresh/writeback.
- [x] Add demo transcript storage.
- [x] Add transcription endpoints backed by local Whisper HTTP.
- [x] Add LLM builder generation and live feedback decision routes.
- [ ] Split large presentation route helpers into smaller domain modules.
- [ ] Add backend tests around normalization, persistence, and feedback decision edge cases.

## Frontend Setup

- [x] Scaffold React + Vite app.
- [x] Add MUI.
- [x] Add workflow library home page.
- [x] Add sidebar/tree navigation.
- [x] Add builder schema page.
- [x] Add slide notes, priority queue, timing, accessibility, and demo transcript controls.
- [x] Add presentation mode and slide-only mode.
- [x] Add microphone capture for demo transcripts and live chunks.
- [x] Add frontend services for workflow, builder, and transcription APIs.
- [ ] Add automated UI tests for the core demo path.
- [ ] Add loading/error state review for all long-running LLM and transcription actions.

## Local Demo Stack

- [x] Add Supabase local setup.
- [x] Add Whisper Dockerfile and compose file.
- [x] Add PowerShell start/stop scripts for the demo stack.
- [x] Require local Whisper model at `references/whisper.cpp/models/ggml-base.en.bin`.
- [ ] Document Supabase CLI version expectations.
- [ ] Add a first-run setup script or single onboarding checklist.

## Open Product/Technical Decisions

- [ ] Keep HTTP feedback decisions or move to SSE/WebSocket for live updates.
- [ ] Decide how long transcript chunks should persist after sessions.
- [ ] Decide whether completed goals should be session-scoped or slide-schema state.
- [ ] Decide where shared prompt files should live long term.
- [ ] Decide whether frontend/backend contracts should be generated from Pydantic/OpenAPI.
