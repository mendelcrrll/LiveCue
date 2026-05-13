$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DockerRoot = Join-Path $RepoRoot "infra\docker"
$SupabaseRoot = Join-Path $RepoRoot "apps\api\supabase"
$DemoPidFile = Join-Path $RepoRoot ".tmp\demo-processes.json"
$WindowTitles = @(
    "RT Feedback - Supabase",
    "RT Feedback - Whisper",
    "RT Feedback - FastAPI",
    "RT Feedback - Web"
)

function Stop-ProcessTree {
    param(
        [int]$ProcessId
    )

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) {
        return
    }

    Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $ProcessId } |
        ForEach-Object {
            Stop-ProcessTree -ProcessId $_.ProcessId
        }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $process) {
        return
    }

    if ($process.MainWindowHandle -ne 0) {
        $process.CloseMainWindow() | Out-Null
        Start-Sleep -Milliseconds 800
    }

    $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $ProcessId -Force
    }
}

Write-Host "Stopping RT Presentation Feedback demo stack..."

Push-Location $DockerRoot
try {
    docker compose -f compose.whisper.yml down
} catch {
    Write-Warning "Could not stop Whisper compose service: $($_.Exception.Message)"
} finally {
    Pop-Location
}

Push-Location $SupabaseRoot
try {
    npx.cmd supabase stop
} catch {
    Write-Warning "Could not stop Supabase: $($_.Exception.Message)"
} finally {
    Pop-Location
}

if (Test-Path $DemoPidFile) {
    $demoProcesses = Get-Content $DemoPidFile -Raw | ConvertFrom-Json

    foreach ($demoProcess in $demoProcesses) {
        Write-Host "Closing demo process: $($demoProcess.Title) ($($demoProcess.Id))"
        Stop-ProcessTree -ProcessId ([int]$demoProcess.Id)
    }

    Remove-Item $DemoPidFile -Force
} else {
    foreach ($title in $WindowTitles) {
        Get-Process powershell -ErrorAction SilentlyContinue |
            Where-Object { $_.MainWindowTitle -eq $title } |
            ForEach-Object {
                Write-Host "Closing window by title: $title"
                Stop-ProcessTree -ProcessId $_.Id
            }
    }
}

Write-Host "Demo stack stop requested."
