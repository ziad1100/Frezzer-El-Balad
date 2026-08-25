# backup-remote-scheduled.ps1 — Daily remote PostgreSQL backup via Task Scheduler.
#
# Setup (run once as Administrator):
#   schtasks /create /tn "FrezzerElBalad-RemoteBackup" /tr "powershell -ExecutionPolicy Bypass -File `"C:\Self Work\Frezzer El Balad\scripts\backup-remote-scheduled.ps1`"" /sc daily /st 03:00 /f
#
# Remove:
#   schtasks /delete /tn "FrezzerElBalad-RemoteBackup" /f
#
# Manual run:
#   powershell -ExecutionPolicy Bypass -File scripts\backup-remote-scheduled.ps1

$ErrorActionPreference = 'Continue'
$repo = 'C:\Self Work\Frezzer El Balad'

if (-not (Test-Path $repo)) {
  Write-Output "[backup] repo not found: $repo"
  exit 0
}
Set-Location $repo

$logDir = Join-Path $env:USERPROFILE 'OneDrive\PizzaBackups'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$log = Join-Path $logDir 'backup-remote.log'

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
"=== Frezzer El Balad remote backup $timestamp ===" | Tee-Object -FilePath $log

# Run the backup
try {
  node scripts/backup-remote.mjs *>> $log
  "OK - exit $LASTEXITCODE" | Tee-Object -FilePath $log -Append
} catch {
  "FAILED: $($_.Exception.Message)" | Tee-Object -FilePath $log -Append
}

# Prune backups older than 30 days
$dbDir = Join-Path $logDir 'db'
if (Test-Path $dbDir) {
  $cutoff = (Get-Date).AddDays(-30)
  $pruned = 0
  Get-ChildItem -Path $dbDir -Filter 'remote-postgres-*.sql.gz' |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
      Remove-Item $_.FullName -Force
      $pruned++
    }
  if ($pruned -gt 0) {
    "Pruned $pruned backup(s) older than 30 days" | Tee-Object -FilePath $log -Append
  }
}

"=== Done ===" | Tee-Object -FilePath $log -Append
