param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$Response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/health" -UseBasicParsing
if ($Response.StatusCode -ne 200) { throw "FastAPI health check failed with HTTP $($Response.StatusCode)." }
Write-Host "FastAPI is responding on port $Port."
