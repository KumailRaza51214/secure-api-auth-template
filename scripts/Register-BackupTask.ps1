param(
    [string]$TaskName = "TaskFlow SQLite Backup",
    [string]$Time = "02:00",
    [switch]$Docker
)

$ErrorActionPreference = "Stop"
$BackupScriptName = if ($Docker) { "Backup-DockerSqlite.ps1" } else { "Backup-Sqlite.ps1" }
$BackupScript = Join-Path $PSScriptRoot $BackupScriptName
$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$BackupScript`""
$Trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::ParseExact($Time, "HH:mm", $null))
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Description "Back up the TaskFlow SQLite database daily." -RunLevel Highest -Force | Out-Null
Write-Host "Registered '$TaskName' for daily execution at $Time using $BackupScriptName."
