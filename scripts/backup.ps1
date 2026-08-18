# Daily ORABI backup — invoked by Task Scheduler (ORABIBackup).
# Re-create on a new machine:
#   schtasks /create /tn ORABIBackup /tr "powershell -ExecutionPolicy Bypass -File `"C:\Self Work\PizzaProject\scripts\backup.ps1`"" /sc daily /st 03:00 /f
$ErrorActionPreference = 'Continue'
$repo = 'C:\Self Work\PizzaProject'

if (-not (Test-Path $repo)) { Write-Output "[backup] repo not found: $repo"; exit 0 }
Set-Location $repo

$log = Join-Path $env:USERPROFILE 'OneDrive\PizzaBackups\backup.log'
"=== ORABI backup $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Tee-Object -FilePath $log
try {
  & npm run backup *>> "$log"
  "OK - exit $LASTEXITCODE" | Tee-Object -FilePath $log -Append
} catch {
  "FAILED: $($_.Exception.Message)" | Tee-Object -FilePath $log -Append
}