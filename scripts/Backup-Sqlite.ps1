param(
    [string]$Destination = "backups"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Database = Join-Path $ProjectRoot "database\todos.db"
$DestinationPath = Join-Path $ProjectRoot $Destination

if (-not (Test-Path $Database)) { throw "SQLite database not found: $Database" }
New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $Database (Join-Path $DestinationPath "todos-$Stamp.db")
Write-Host "Backup created in $DestinationPath"
