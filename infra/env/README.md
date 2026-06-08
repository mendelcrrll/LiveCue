# Environment Configuration

The backend reads environment variables from `apps/api/.env` through `backend/config.py`.

Do not commit real `.env` files or secrets.

## Minimal Local File

Create `apps/api/.env`:

```text
API_ENV=development
API_HOST=127.0.0.1
API_PORT=8000

DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54332/postgres
SUPABASE_URL=http://127.0.0.1:54331
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/auth/google/callback
FRONTEND_OAUTH_REDIRECT_URL=http://127.0.0.1:5173/
COOKIE_SAMESITE=auto

OPENAI_API_KEY=
LLM_PROVIDER=openai

STT_PROVIDER=whisper
WHISPER_BASE_URL=http://127.0.0.1:8081
```

## Required By Feature

Basic API and seeded local data:

- `DATABASE_URL`

Google sign-in, import, thumbnail refresh, and notes writeback:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `FRONTEND_OAUTH_REDIRECT_URL`
- `COOKIE_SAMESITE`

Builder schema generation and live feedback decisions:

- `OPENAI_API_KEY`

Demo transcript and live presentation transcription:

- `WHISPER_BASE_URL`

## Google OAuth Notes

For local development, configure the Google OAuth app with:

```text
http://127.0.0.1:8000/api/auth/google/callback
```

The frontend OAuth redirect should usually be:

```text
http://127.0.0.1:5173/
```

If you use `localhost` instead of `127.0.0.1`, keep the backend CORS settings, Google redirect URI, and browser URL consistent.

For production, Vercel proxies `/api` to Render so the browser always uses the frontend origin.
Configure the Google OAuth client and Render environment with the Vercel production URL:

```text
GOOGLE_REDIRECT_URI=https://<your-vercel-domain>/api/auth/google/callback
FRONTEND_OAUTH_REDIRECT_URL=https://<your-vercel-domain>/
COOKIE_SAMESITE=lax
API_ENV=production
```

Add the same `GOOGLE_REDIRECT_URI` value to the Google OAuth client's authorized redirect URIs.
Do not set `VITE_API_BASE_URL` to the Render URL in Vercel; browser requests must remain on `/api`
so the session cookie is first-party in Safari and Firefox.

## Frontend Environment

The web app can use `VITE_API_BASE_URL` during local development. Production builds ignore it and
always use same-origin `/api`.
