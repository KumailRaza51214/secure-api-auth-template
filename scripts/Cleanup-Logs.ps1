param(
    [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Cutoff = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem $ProjectRoot -File -Filter "*.log" -ErrorAction SilentlyContinue |
    Where-Object LastWriteTime -lt $Cutoff |
    Remove-Item -Force
Write-Host "Removed log files older than $KeepDays days."
