# API Contracts

This document describes the HTTP API shape currently used by the React app. The backend is mounted at `http://127.0.0.1:8000` by default, and frontend service modules call paths under `/api`.

## Conventions

- JSON endpoints return JSON unless they explicitly use `204 No Content`.
- Authenticated Google flows use the `session_id` cookie.
- Frontend requests include credentials through `fetch(..., { credentials: "include" })`.
- IDs for persisted presentations, slides, and workflow nodes are UUID strings.
- Provider-specific Google payloads should be normalized before becoming frontend contracts.

## Health

### `GET /health`

Returns:

```json
{ "status": "ok" }
```

## Auth

### `GET /api/auth/google/login`

Starts Google OAuth. Redirects the browser to Google.

### `GET /api/auth/google/callback`

Completes OAuth, stores credentials for the local session, sets `session_id`, and redirects back to the frontend.

### `GET /api/auth/session`

Returns whether the browser currently has an authenticated Google session.

Conceptual response:

```json
{
  "isAuthenticated": true
}
```

### `GET /api/auth/debug/session`

Debug helper for inspecting local session state during development.

### `POST /api/auth/logout`

Clears the local session cookie and associated stored credentials.

## Google

### `GET /api/google/presentations/{presentation_id}`

Fetches a Google Slides presentation through the authenticated user's Google credentials.

Used for direct Google API validation and debugging. The main app import path is the presentations API below.

## Workflow Library

### `GET /api/presentations/tree`

Returns the tree rendered by the home page sidebar and workflow cards.

Conceptual response:

```json
{
  "tree": [
    {
      "id": "workflow-node-id",
      "type": "folder",
      "name": "Demo Decks",
      "children": []
    }
  ]
}
```

File nodes may include `presentationId`, `googlePresentationId`, `thumbnailUrl`, and `firstSlideId` when they are linked to an imported deck.

### `POST /api/presentations/folders`

Creates a folder under an existing workflow folder.

Request:

```json
{
  "parent_id": "workflow-folder-id",
  "name": "Sprint Demo"
}
```

Returns the created workflow node.

### `POST /api/presentations/files`

Creates a file node. When `source_kind` is `google_slides_request`, the backend also imports the Google Slides deck and links the resulting presentation.

Request:

```json
{
  "parent_id": "workflow-folder-id",
  "name": "Final Presentation",
  "source_kind": "google_slides_request",
  "google_presentation_id": "google-slides-id"
}
```

Manual files use `source_kind: "manual"` and do not require a Google presentation ID.

### `DELETE /api/presentations/nodes/{node_id}`

Deletes a workflow node. Returns `204 No Content`.

## Presentation Import

### `POST /api/presentations/import`

Imports a Google Slides presentation directly.

Request:

```json
{
  "presentation_id": "google-slides-id"
}
```

Response:

```json
{
  "id": "local-presentation-uuid",
  "google_presentation_id": "google-slides-id",
  "title": "Deck title",
  "slide_count": 12
}
```

The home workflow usually uses `POST /api/presentations/files` instead so the imported deck appears in the library tree.

## Builder Schema

### `GET /api/presentations/{presentation_id}/builder-schema`

Loads the deck, slides, speaker notes, demo transcripts, priority goals, accessibility checks, timing goals, and last feedback state needed by builder and presenter views.

### `PUT /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}`

Saves local builder schema data for one slide.

Request:

```json
{
  "buildData": {
    "priorityItems": [],
    "accessibilityChecks": [],
    "timingGoal": { "minutes": 1, "seconds": 30 }
  }
}
```

Returns the updated slide.

### `PUT /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}/notes`

Saves speaker notes back to Google Slides and mirrors them into local slide context.

Request:

```json
{
  "speakerNotes": "Presenter notes for this slide."
}
```

Requires a Google session.

### `PUT /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}/demo-transcript`

Stores the demo transcript used to guide schema generation.

Request:

```json
{
  "demoTranscript": "What the presenter plans to say.",
  "source": "manual"
}
```

`source` is currently `manual` or `whisper`.

### `POST /api/presentations/{presentation_id}/builder-schema/slides/{slide_id}/generate`

Generates slide-level builder data from slide context, speaker notes, demo transcript, neighbor slide summaries, existing builder data, and pain points.

Request:

```json
{
  "speakerNotes": "Optional override",
  "demoTranscript": "Optional transcript text",
  "model": "optional-model-name"
}
```

Returns normalized `BuilderSlideData`.

### `POST /api/presentations/{presentation_id}/refresh-google-context`

Refetches the Google presentation, refreshes slide context and speaker notes, and preserves local builder/demo data.

Requires a Google session.

### `GET /api/presentations/{presentation_id}/slides/{slide_id}/thumbnail`

Refreshes one slide thumbnail from Google and stores the URL in local slide context.

Requires a Google session.

## Transcription

### `POST /api/transcription/transcribe`

Transcribes one uploaded audio file without storing it as a live chunk.

Request body: multipart form data with `file`.

Response:

```json
{
  "text": "Transcribed speech."
}
```

Used by builder demo transcript recording.

### `POST /api/transcription/chunks`

Transcribes and stores a live presentation audio chunk.

Request body: multipart form data with:

- `file`
- `presentation_id`
- `slide_id`
- `chunk_started_at_ms`
- `chunk_ended_at_ms`

Response includes the transcript text and whether it was saved.

### `DELETE /api/transcription/presentations/{presentation_id}/chunks`

Deletes stored live transcript chunks for a presentation.

Used when leaving presenter mode and for manual cleanup.

## Feedback Decision

### `POST /api/presentations/{presentation_id}/slides/{slide_id}/feedback-decision`

Evaluates recent transcript chunks against the active slide's builder data.

Request:

```json
{
  "buildData": {
    "priorityItems": [],
    "accessibilityChecks": [],
    "timingGoal": { "minutes": 1, "seconds": 30 }
  },
  "windowSize": 12,
  "model": "optional-model-name"
}
```

Response:

```json
{
  "summary": "Short presenter-facing status.",
  "goalUpdates": [],
  "accessibilityUpdates": [],
  "timing": {
    "elapsedMs": 45000,
    "goalMs": 90000,
    "status": "on_track",
    "message": "You are pacing well."
  },
  "frontendUpdates": [],
  "updatedSlide": {}
}
```

The backend normalizes LLM output before returning it:

- Goal updates must refer to configured goal IDs.
- Only positive goal completions are applied.
- Completed goals stay completed.
- Accessibility statuses are limited to `pending`, `satisfied`, or `attention`.
- Timing status is limited to `on_track`, `over_time`, `under_time`, or `unknown`.
- Frontend updates are capped to keep the presenter panel readable.

## Shared Contract Direction

`packages/contracts` is still a documentation placeholder. If the team adds generated client types or shared schema files, they should mirror the endpoint shapes documented here and the Pydantic models in `apps/api/backend/schemas`.
