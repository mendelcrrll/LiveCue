# Event Catalog

## Purpose

These events describe the live session boundary between backend processing and presenter-facing feedback.

## Proposed Events

- `session.started`
- `session.ended`
- `transcript.chunk_received`
- `transcript.segment_finalized`
- `goal.matched`
- `goal.missed`
- `accessibility.alert_raised`
- `feedback.tip_generated`
- `feedback.summary_ready`

## Event Design Notes

- Use past-tense meaning for completed events.
- Keep names dot-separated and domain-oriented.
- Include a session identifier on every live-session event.
- Distinguish raw transcript ingestion from interpreted feedback.

## Minimum Event Fields

- `event_name`
- `event_version`
- `session_id`
- `occurred_at`
- `payload`
