param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
$Python = Join-Path $ProjectRoot "fastapi_venv\Scripts\python.exe"
if (-not (Test-Path $Python)) { $Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe" }
if (-not (Test-Path $Python)) { throw "Python environment not found. Run .\scripts\Setup-Dev.ps1 first." }

& $Python -m uvicorn main:app --reload --host 127.0.0.1 --port $Port
