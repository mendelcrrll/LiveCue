# Shared Packages

`packages` is reserved for assets that should be shared across the frontend and backend.

At the moment, the app's live contracts are implemented directly in:

- Frontend service modules under `apps/web/src/services`.
- Backend Pydantic schemas under `apps/api/backend/schemas`.
- Backend prompts in `apps/api/backend/ai/model_client.py`.

The folders here document the intended long-term home for shared contracts and prompts once the team is ready to extract them.

## Current Folders

- `contracts`: API and event schema documentation or generated client-safe types.
- `prompts`: reusable prompt assets, evaluation rubrics, and prompt tests.

## Extraction Guidance

Move something into `packages` when:

- Both frontend and backend need to agree on the same names or payload shapes.
- Prompt text needs review, versioning, or testing outside backend route code.
- Repeated documentation is drifting between apps.

Do not move code here just to make the monorepo look symmetrical. Keep shared packages purposeful.
