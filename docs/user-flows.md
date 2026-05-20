# User Flows

## Core Story

A presenter imports an existing Google Slides deck, configures what they want to accomplish on each slide, rehearses or records intended wording, then presents with private feedback that tracks goals, accessibility checks, and pacing.

## Flow 1: Connect Google

1. User opens the app at `http://127.0.0.1:5173`.
2. User triggers Google sign-in when importing or opening locked Google-backed content.
3. Backend starts OAuth at `/api/auth/google/login`.
4. Google redirects back to `/api/auth/google/callback`.
5. Backend stores local credentials for the session and sets `session_id`.
6. Frontend checks `/api/auth/session` to decide whether Google-backed files are unlocked.

## Flow 2: Manage Workflow Library

1. Home page loads `/api/presentations/tree`.
2. User selects folders and files from the sidebar or card grid.
3. User creates folders or manual files through the workflow action dialog.
4. User can create a Google Slides file by entering a presentation ID.
5. Backend imports the deck and links the resulting local presentation to the workflow file.
6. Imported files can be opened in builder mode.

## Flow 3: Configure A Deck In Builder Mode

1. User opens `/builder/:deckId`.
2. Frontend loads the workflow tree and builder schema data.
3. User selects a slide from the slide navigator.
4. User edits speaker notes, priority goals, timing goal, accessibility checks, and demo transcript.
5. Speaker notes can be saved back to Google Slides.
6. Builder schema changes are saved locally.
7. User can refresh Google context after saving local changes.

## Flow 4: Generate Builder Schema

1. User records or types a demo transcript for a slide.
2. Demo recording posts audio to `/api/transcription/transcribe`.
3. Backend calls the local Whisper service and returns text.
4. Demo transcript is stored per slide.
5. User generates schema for one slide or the full deck.
6. Backend builds an LLM context from slide text, notes, demo transcript, neighboring slides, and existing builder data.
7. Backend normalizes the generated goals, timing, and accessibility checks.
8. User reviews and saves the generated schema.

## Flow 5: Launch Presenter Mode

1. User clicks the presenter action from builder mode.
2. App opens a slide-only tab at `/presentation-schema/:deckId?mode=slide`.
3. Current tab navigates to `/presentation-schema/:deckId`.
4. Presenter mode loads the same builder schema data.
5. Slide changes sync to the slide-only window through `localStorage`.
6. Presenter can hide or show navigation chrome.

## Flow 6: Receive Live Feedback

1. User starts the presenter timer.
2. Browser requests microphone access.
3. Frontend records short audio chunks and uploads each chunk with presentation ID, slide ID, and elapsed timestamps.
4. Backend transcribes each chunk through the local Whisper service and stores it.
5. Frontend asks for a feedback decision after a saved chunk.
6. Backend evaluates recent transcript chunks against the slide's configured goals and accessibility checks.
7. Backend updates completed goals, accessibility state, timing state, and the slide's last feedback decision.
8. Presenter feedback panel updates with the latest state.

## Flow 7: End Or Reset A Session

1. User pauses or resets the presenter timer.
2. Frontend stops microphone recording.
3. Leaving presenter mode sends a cleanup request for stored transcript chunks.
4. User can also manually delete transcript chunks for the active deck.
5. The slide builder schema and completed goal/accessibility state remain local database state unless explicitly changed.

## Current Demo Assumptions

- The demo runs locally with Supabase, FastAPI, Vite, and Whisper.
- Google import and speaker-note sync require OAuth credentials.
- LLM generation and feedback decisions require `OPENAI_API_KEY`.
- Live transcript chunks are temporary and are cleaned up around presenter mode.
- The current transport is HTTP request/response, not WebSocket/SSE.
