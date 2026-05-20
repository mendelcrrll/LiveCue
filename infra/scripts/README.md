# Scripts

This folder contains PowerShell helpers for the local demo stack.

## `start-demo.ps1`

Starts the integrated demo:

1. Verifies the backend virtualenv exists.
2. Verifies the Whisper model exists.
3. Optionally rebuilds the `rt-whisper:local` Docker image.
4. Starts Supabase.
5. Waits for Supabase Postgres.
6. Starts the Whisper Docker compose service.
7. Waits for Whisper.
8. Starts FastAPI.
9. Waits for `/health` and `/api/presentations/tree`.
10. Starts Vite.
11. Prints `http://127.0.0.1:5173`.

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1
```

Rebuild Whisper first:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1 -RebuildWhisper
```

Start services and return without waiting for Enter:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1 -NoWait
```

## `stop-demo.ps1`

Stops processes recorded by `start-demo.ps1` and stops the local Supabase/Whisper services.

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\stop-demo.ps1
```

## State File

The scripts use:

```text
.tmp/demo-processes.json
```

This is local runtime state and should not be committed.
