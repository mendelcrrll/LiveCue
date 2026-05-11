# Scripts Placeholder

Use this folder for repeatable helper scripts that support setup, CI, or local development.

Examples:

- database bootstrap helpers
- seed data helpers
- environment validation scripts
- CI convenience scripts

## Demo launcher

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1
```

Leave the launcher window open while demoing. Press Enter in that window to stop
all demo services and close the service terminals.

If the Whisper Dockerfile changed, rebuild the image first:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1 -RebuildWhisper
```

To launch and immediately return to the shell without the controller prompt:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1 -NoWait
```

To stop the demo stack:

```powershell
powershell -ExecutionPolicy Bypass -File infra\scripts\stop-demo.ps1
```
