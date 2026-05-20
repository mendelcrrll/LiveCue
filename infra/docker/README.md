# Docker

This folder contains the local Whisper service container used by the demo stack.

## Files

- `whisper.Dockerfile`: builds `rt-whisper:local` from `references/whisper.cpp`.
- `compose.whisper.yml`: runs the local inference server and maps host port `8081` to container port `8080`.

## Build

From the repository root:

```powershell
docker build -f infra/docker/whisper.Dockerfile -t rt-whisper:local references/whisper.cpp
```

The demo script can also build it:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1 -RebuildWhisper
```

## Run

From `infra/docker`:

```powershell
docker compose -f compose.whisper.yml up
```

The service is expected at:

```text
http://127.0.0.1:8081
```

`ASRTranscriber` posts audio to:

```text
http://127.0.0.1:8081/inference
```

## Model Requirement

The compose file mounts:

```text
references/whisper.cpp/models
```

The current command expects:

```text
references/whisper.cpp/models/ggml-base.en.bin
```

Download it from the whisper.cpp model scripts before running the demo stack.
