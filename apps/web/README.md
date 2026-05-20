# Web App

`apps/web` contains the React + Vite frontend for RT Presentation Feedback.

## Stack

- React
- Vite
- React Router
- MUI components and icons
- Browser `MediaRecorder` for microphone capture
- `localStorage` for presenter/slide-only tab coordination

## Main Routes

- `/`: workflow library home page.
- `/builder/:deckId`: builder schema editor for a linked presentation.
- `/presentation-schema`: presenter mode for the first linked presentation found.
- `/presentation-schema/:deckId`: presenter mode for a specific linked presentation.
- `/presentation-schema/:deckId?mode=slide`: slide-only display window.

## Source Layout

```text
src/
  App.jsx                         Route definitions.
  pages/
    Home.jsx                      Workflow tree and library actions.
    BuilderSchema.jsx             Slide builder schema editor.
    PresentationSchema.jsx        Presenter mode and slide-only mode.
  components/
    AppBar.jsx                    Shared top bar.
    SideBar.jsx                   Workflow tree navigation.
    SlideBuilderPanel.jsx         Main per-slide builder controls.
    DemoTranscriptCard.jsx        Demo transcript text/recording UI.
    PresenterWorkspace.jsx        Presenter mode layout and controls.
    PresenterFeedbackPanel.jsx    Goals, accessibility, timing, and transcript feedback.
    FullPageSlide.jsx             Slide-only window display.
  services/
    apiClient.js                  Shared fetch helpers and API base URL.
    PresentationWorkflowService.js
    PresentationBuilderService.js
    TranscriptionService.js
  data/
    presentationTree.js           Tree traversal helpers.
  utils/
    slideUtils.js                 Slide sorting and utilities.
```

## Run

From the repository root:

```powershell
npm --workspace web run dev
```

The default Vite URL is `http://127.0.0.1:5173` when started through `infra/scripts/start-demo.ps1`.

## Build And Lint

```powershell
npm --workspace web run lint
npm --workspace web run build
```

## API Configuration

The frontend reads `VITE_API_BASE_URL`.

If it is not set, `src/services/apiClient.js` defaults to:

```text
http://127.0.0.1:8000
```

All API requests should go through `services/*` rather than calling `fetch` directly from UI components, except for specialized upload cases already isolated in `TranscriptionService.js`.

## Current UX Flow

1. `Home.jsx` loads the workflow tree and auth state.
2. Users create folders/files or import Google Slides decks.
3. Linked presentation files open in `BuilderSchema.jsx`.
4. Builder mode lets users configure slide goals, timing, accessibility checks, notes, and demo transcript.
5. Builder mode launches presenter mode and a slide-only window.
6. Presenter mode records microphone chunks, uploads them for transcription, and asks the backend for feedback decisions.

## Notes For Contributors

- Keep route-level orchestration in page components.
- Keep reusable UI in `components`.
- Keep HTTP details in `services`.
- When adding a new backend endpoint, add or update the matching service function first.
- Be careful with unsaved builder data. `BuilderSchema.jsx` tracks dirty slide schema and dirty speaker notes separately.
- Presenter mode relies on `localStorage` keys to sync the active slide and close the slide-only tab.
