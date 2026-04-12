# User Flows

## Core Story

The presenter wants to use an existing Google Slides deck while receiving live, private feedback during delivery.

## Flow 1: Authenticate

1. The user opens the application.
2. The user signs in with Google.
3. The backend stores the resulting session and provider tokens securely.

## Flow 2: Select A Deck

1. The frontend requests the user's slide decks.
2. The backend queries Google on the user's behalf.
3. The user selects a deck to configure.

## Flow 3: Configure The Presentation

1. The user enters presentation goals.
2. The user adds presenter notes or priority topics.
3. The user enables or disables feedback features.
4. The configuration is saved as a presentation profile.

## Flow 4: Start A Live Session

1. The user launches presentation mode.
2. The app opens the audience-facing deck and the private feedback interface.
3. The backend creates a live session record and begins processing audio and events.

## Flow 5: Receive Live Feedback

1. Speech is transcribed continuously.
2. The transcript is evaluated against goals and accessibility checks.
3. Alerts and suggestions are streamed to the presenter UI.

## Flow 6: End And Review

1. The presenter ends the session.
2. The backend finalizes session artifacts.
3. The app can later provide summaries, flagged moments, and progress against goals.
