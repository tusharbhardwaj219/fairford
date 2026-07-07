# Loads the real secret values from ../.env.yaml into GCP Secret Manager.
# Resilient + idempotent: never stops mid-loop, updates existing secrets, creates missing ones.
# Reads values at runtime (contains NO secrets) and writes each via a temp file so no trailing
# newline corrupts the secret and nothing lands in shell history.
$envYaml = Join-Path $PSScriptRoot '..\.env.yaml'
if (-not (Test-Path $envYaml)) { Write-Host "ERROR: .env.yaml not found at $envYaml"; return }

$secretKeys = 'MONGO_URI','JWT_SECRET','JWT_REFRESH_SECRET','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','EMAIL_PASS'
$map = @{}
foreach ($ln in Get-Content $envYaml) {
  if ($ln -match '^\s*([A-Z_]+):\s*"?(.*?)"?\s*$') { $map[$Matches[1]] = $Matches[2] }
}

foreach ($k in $secretKeys) {
  if (-not $map.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($map[$k]) -or $map[$k] -like 'FILL_*') {
    Write-Host "SKIP  $k  (not set in .env.yaml)"; continue
  }
  $tmp = New-TemporaryFile
  [System.IO.File]::WriteAllText($tmp.FullName, $map[$k])   # no trailing newline

  $null = gcloud secrets describe $k --format="value(name)" 2>&1
  $exists = ($LASTEXITCODE -eq 0)

  if ($exists) {
    gcloud secrets versions add $k --data-file="$($tmp.FullName)" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "OK    $k  (new version added)" } else { Write-Host "FAIL  $k  (versions add)" }
  } else {
    gcloud secrets create $k --replication-policy=automatic --data-file="$($tmp.FullName)" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Host "OK    $k  (created)" } else { Write-Host "FAIL  $k  (create)" }
  }
  Remove-Item $tmp.FullName -Force -ErrorAction SilentlyContinue
}
Write-Host "--- Secret Manager load complete ---"
