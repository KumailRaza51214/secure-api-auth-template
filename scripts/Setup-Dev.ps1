param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$Python = Join-Path $ProjectRoot "fastapi_venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
    $Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
}
if (-not (Test-Path $Python)) {
    py -3 -m venv (Join-Path $ProjectRoot ".venv")
    $Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
}

if (-not $SkipInstall) {
    & $Python -m pip install --upgrade pip
    & $Python -m pip install -r requirements.txt
}

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Warning "Created .env from .env.example. Set SECRET_KEY before running outside development."
}

New-Item -ItemType Directory -Force -Path "backups", "logs" | Out-Null
Write-Host "Development environment is ready. Run .\scripts\Start-Dev.ps1"
