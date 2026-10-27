# Load .env into the current PowerShell session. Run from the repo root:  . .\scripts\load-env.ps1
$envFile = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envFile)) { Write-Host ".env not found at $envFile" -ForegroundColor Red; return }
Get-Content $envFile | Where-Object { $_ -match '^\s*[^#\s][^=]*=' } | ForEach-Object {
  $k, $v = $_ -split '=', 2
  [Environment]::SetEnvironmentVariable($k.Trim(), $v.Trim(), 'Process')
}
$missing = (Get-Content $envFile | Where-Object { $_ -match '^\s*[^#\s][^=]*=\s*$' } | ForEach-Object { ($_ -split '=',2)[0].Trim() }) -join ', '
Write-Host "Loaded .env into this session."
if ($missing) { Write-Host "Still empty: $missing" -ForegroundColor Yellow }
