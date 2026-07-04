# Loads the real secret values from ../.env.yaml into GCP Secret Manager.
# Reads values at runtime (this script contains NO secrets) and writes each via a
# temp file so no trailing newline corrupts the secret and nothing lands in shell history.
$ErrorActionPreference = 'Stop'
$envYaml = Join-Path $PSScriptRoot '..\.env.yaml'
if (-not (Test-Path $envYaml)) { throw ".env.yaml not found at $envYaml — create it first (see .env.yaml.example)." }

$secretKeys = 'MONGO_URI','JWT_SECRET','JWT_REFRESH_SECRET','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','EMAIL_PASS'
$map = @{}
foreach ($ln in Get-Content $envYaml) {
  if ($ln -match '^\s*([A-Z_]+):\s*"?(.*?)"?\s*$') { $map[$Matches[1]] = $Matches[2] }
}

foreach ($k in $secretKeys) {
  if (-not $map.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($map[$k]) -or $map[$k] -like 'FILL_*') {
    Write-Warning "skip $k (not set in .env.yaml)"; continue
  }
  $tmp = New-TemporaryFile
  [System.IO.File]::WriteAllText($tmp.FullName, $map[$k])   # no trailing newline
  $exists = (gcloud secrets describe $k --format='value(name)' 2>$null)
  if ($exists) {
    gcloud secrets versions add $k --data-file="$($tmp.FullName)" | Out-Null
    Write-Host "updated secret: $k"
  } else {
    gcloud secrets create $k --replication-policy=automatic --data-file="$($tmp.FullName)" | Out-Null
    Write-Host "created secret: $k"
  }
  Remove-Item $tmp.FullName -Force
}
Write-Host "Secret Manager load complete."
