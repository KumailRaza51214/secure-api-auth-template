param(
    [string]$Destination = "backups"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI was not found."
}

$Service = & docker compose ps --services --filter "status=running" | Where-Object { $_ -eq "api" }
if (-not $Service) { throw "The Docker API service is not running." }

$DestinationPath = Join-Path $ProjectRoot $Destination
New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ContainerPath = "/tmp/todos-$Stamp.db"
$BackupPath = Join-Path $Destination "todos-docker-$Stamp.db"

$BackupCode = "import sqlite3; source=sqlite3.connect('/app/database/todos.db'); target=sqlite3.connect('$ContainerPath'); source.backup(target); target.close(); source.close()"
& docker compose exec -T api python -c $BackupCode
if ($LASTEXITCODE -ne 0) { throw "Could not create a consistent SQLite backup in the container." }

& docker compose cp "api:$ContainerPath" $BackupPath
if ($LASTEXITCODE -ne 0) { throw "Could not copy the Docker SQLite backup to the host." }

& docker compose exec -T api python -c "import os; os.remove('$ContainerPath')"
Write-Host "Docker SQLite backup created: $BackupPath"