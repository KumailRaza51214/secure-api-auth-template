param(
    [switch]$Build,
    [switch]$FollowLogs,
    [int]$Port = 8000,
    [int]$WaitSeconds = 60
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI was not found. Install and start Docker Desktop first."
}

if (-not (Test-Path ".env")) {
    throw "Missing .env. Copy .env.example to .env and set SECRET_KEY before deploying."
}

$ComposeArgs = @("compose", "up", "-d")
if ($Build) { $ComposeArgs += "--build" }
& docker @ComposeArgs
if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed to start the API." }

$Deadline = (Get-Date).AddSeconds($WaitSeconds)
do {
    try {
        $Response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing -TimeoutSec 3
        if ($Response.StatusCode -eq 200) {
            Write-Host "TaskFlow API is healthy at http://127.0.0.1:$Port"
            if ($FollowLogs) { & docker compose logs -f api }
            exit 0
        }
    } catch {
        Start-Sleep -Seconds 2
    }
} while ((Get-Date) -lt $Deadline)

Write-Error "The API did not become healthy within $WaitSeconds seconds. Recent container logs:"
& docker compose ps
& docker compose logs --tail 100 api
exit 1