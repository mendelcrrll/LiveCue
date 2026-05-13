param(
    [switch]$RebuildWhisper,
    [switch]$NoWait
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$ApiRoot = Join-Path $RepoRoot "apps\api"
$WebRoot = Join-Path $RepoRoot "apps\web"
$SupabaseRoot = Join-Path $ApiRoot "supabase"
$DockerRoot = Join-Path $RepoRoot "infra\docker"
$WhisperModel = Join-Path $RepoRoot "references\whisper.cpp\models\ggml-base.en.bin"
$ApiPython = Join-Path $ApiRoot ".venv\Scripts\python.exe"
$DemoStateDir = Join-Path $RepoRoot ".tmp"
$DemoPidFile = Join-Path $DemoStateDir "demo-processes.json"
$DemoProcesses = @()

function Assert-PathExists {
    param(
        [string]$Path,
        [string]$Message
    )

    if (-not (Test-Path $Path)) {
        throw $Message
    }
}

function Start-DemoWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $escapedTitle = $Title.Replace("'", "''")
    $escapedDirectory = $WorkingDirectory.Replace("'", "''")
    $windowCommand = "`$Host.UI.RawUI.WindowTitle = '$escapedTitle'; Set-Location '$escapedDirectory'; $Command"

    $process = Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        $windowCommand
    ) -PassThru

    $script:DemoProcesses += [pscustomobject]@{
        Title = $Title
        Id = $process.Id
    }
}

function Wait-ForHttp {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 | Out-Null
            Write-Host "[ok] $Name is responding: $Url"
            return
        } catch {
            Start-Sleep -Seconds 2
        }
    }

    Write-Warning "$Name did not respond within $TimeoutSeconds seconds: $Url"
}

function Wait-ForTcp {
    param(
        [string]$Name,
        [int]$Port,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $connection = Test-NetConnection 127.0.0.1 -Port $Port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "[ok] $Name is listening on port $Port"
            return
        }

        Start-Sleep -Seconds 2
    }

    Write-Warning "$Name did not listen on port $Port within $TimeoutSeconds seconds."
}

Assert-PathExists $ApiPython "Missing API virtualenv. Expected: $ApiPython"
Assert-PathExists $WhisperModel "Missing Whisper model. Download it with: references\whisper.cpp\models\download-ggml-model.cmd base.en"

New-Item -ItemType Directory -Force -Path $DemoStateDir | Out-Null

Write-Host "Starting RT Presentation Feedback demo stack..."
Write-Host "Repo: $RepoRoot"

if ($RebuildWhisper) {
    Write-Host "Rebuilding rt-whisper:local..."
    Push-Location $RepoRoot
    try {
        docker build `
            -f infra/docker/whisper.Dockerfile `
            -t rt-whisper:local `
            references/whisper.cpp
    } finally {
        Pop-Location
    }
}

Start-DemoWindow `
    -Title "RT Feedback - Supabase" `
    -WorkingDirectory $SupabaseRoot `
    -Command "npx.cmd supabase start"

Write-Host ""
Write-Host "Waiting for Supabase before starting app services..."
Wait-ForTcp -Name "Supabase Postgres" -Port 54332 -TimeoutSeconds 180

Start-DemoWindow `
    -Title "RT Feedback - Whisper" `
    -WorkingDirectory $DockerRoot `
    -Command "docker compose -f compose.whisper.yml up"

Wait-ForHttp -Name "Whisper" -Url "http://127.0.0.1:8081" -TimeoutSeconds 180

Start-DemoWindow `
    -Title "RT Feedback - FastAPI" `
    -WorkingDirectory $ApiRoot `
    -Command ".\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload"

Wait-ForHttp -Name "FastAPI" -Url "http://127.0.0.1:8000/health" -TimeoutSeconds 120
Wait-ForHttp -Name "Presentation API" -Url "http://127.0.0.1:8000/api/presentations/tree" -TimeoutSeconds 120

Start-DemoWindow `
    -Title "RT Feedback - Web" `
    -WorkingDirectory $RepoRoot `
    -Command "npm.cmd --workspace web run dev -- --host 127.0.0.1 --port 5173 --strictPort"

$DemoProcesses | ConvertTo-Json | Set-Content -Path $DemoPidFile -Encoding utf8

Write-Host ""
Wait-ForHttp -Name "Vite" -Url "http://127.0.0.1:5173" -TimeoutSeconds 120

Write-Host ""
Write-Host "Demo stack launched."
Write-Host "Open: http://127.0.0.1:5173"
Write-Host ""
Write-Host "Tip: run with -RebuildWhisper after Dockerfile changes:"
Write-Host "  powershell -ExecutionPolicy Bypass -File infra\scripts\start-demo.ps1 -RebuildWhisper"

if (-not $NoWait) {
    Write-Host ""
    Write-Host "Leave this window open while demoing."
    Write-Host "Press Enter here to stop Supabase, Whisper, FastAPI, and Vite."

    try {
        Read-Host | Out-Null
    } finally {
        & (Join-Path $PSScriptRoot "stop-demo.ps1")
    }
}
