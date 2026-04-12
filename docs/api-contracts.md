# API Contracts Draft

## Primary Resources

- `users`
- `decks`
- `presentation-configs`
- `sessions`
- `feedback-events`

## Initial Backend Responsibilities

- authenticate the user with Google
- list available slide decks
- retrieve deck metadata needed by the frontend
- create and manage presentation configurations
- create and manage live sessions
- stream feedback events during a live session

## Contract Design Rules

- Keep external API payloads stable even if providers change.
- Separate transport schemas from provider-specific response formats.
- Normalize transcript, goal, and feedback objects early.
- Prefer explicit versioning if event payloads change.

## Example Contract Categories

- authentication and session status
- deck listing and deck selection
- presentation configuration create and update
- live session start and stop
- real-time feedback events

## Shared Package Role

The `packages/contracts` folder will eventually hold:

- canonical schema definitions
- shared event names
- payload shape documentation
- any generated client-safe types if the frontend adopts them later
