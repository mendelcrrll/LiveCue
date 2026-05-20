# Event Catalog

The app does not currently stream backend events over WebSocket or SSE. The current feedback loop is HTTP based:

1. Frontend uploads an audio chunk.
2. Backend transcribes and stores the chunk.
3. Frontend requests a feedback decision.
4. Backend returns normalized updates and an updated slide.

This catalog records the event vocabulary we should preserve when a streaming transport is added.

## Current Frontend Update Shape

`POST /api/presentations/{presentation_id}/slides/{slide_id}/feedback-decision` returns `frontendUpdates`.

Each update is normalized to:

```json
{
  "kind": "goal",
  "id": "priority-item-id",
  "action": "goal_completed",
  "message": "Goal reached."
}
```

Known `kind` values:

- `goal`
- `accessibility`
- `timing`
- `log`

Known action examples:

- `goal_completed`
- `accessibility_satisfied`
- `accessibility_attention`
- `wait_for_transcript`

These updates are derived from the canonical decision fields, so the UI should prefer `updatedSlide`, `goalUpdates`, `accessibilityUpdates`, and `timing` for durable state.

## Durable Decision Fields

Feedback decisions currently carry:

- `summary`: short presenter-facing decision summary.
- `goalUpdates`: completed priority items with evidence and confidence.
- `accessibilityUpdates`: status/evidence updates for configured accessibility checks.
- `timing`: elapsed time, target time, pacing status, and message.
- `updatedSlide`: full slide object after backend state changes are applied.

## Future Live Events

When the app moves to WebSocket or SSE, use these names unless there is a strong reason to change them:

- `session.started`
- `session.ended`
- `slide.changed`
- `transcript.chunk_received`
- `transcript.chunk_transcribed`
- `goal.completed`
- `accessibility.satisfied`
- `accessibility.attention`
- `timing.updated`
- `feedback.decision_ready`
- `feedback.summary_ready`

## Event Design Notes

- Use past-tense names for completed facts.
- Keep names dot-separated and domain-oriented.
- Include presentation/session ID and slide ID whenever the event is slide-specific.
- Distinguish raw transcript ingestion from interpreted feedback.
- Keep durable state in explicit fields instead of only free-form messages.

## Minimum Future Event Fields

```json
{
  "event_name": "feedback.decision_ready",
  "event_version": 1,
  "presentation_id": "presentation-uuid",
  "slide_id": "slide-uuid",
  "occurred_at": "2026-05-20T12:00:00Z",
  "payload": {}
}
```
