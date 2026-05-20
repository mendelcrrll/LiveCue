# Contracts Package

This package is reserved for shared API and event definitions used by both the frontend and backend.

## Current Source Of Truth

For now, contracts live in:

- `docs/api-contracts.md` for human-readable endpoint documentation.
- `apps/api/backend/schemas` for Pydantic request and response models.
- `apps/web/src/services` for frontend client expectations.

## Candidate Future Contents

- Generated TypeScript types from FastAPI/OpenAPI.
- Shared event names from `docs/event-catalog.md`.
- JSON schema snapshots for feedback decisions.
- Contract tests that verify frontend service expectations against backend OpenAPI.

## Rule Of Thumb

If a field is consumed by the presenter experience, document it before changing it. The most sensitive contracts right now are builder schema data, feedback decisions, workflow tree nodes, and transcript chunk responses.
