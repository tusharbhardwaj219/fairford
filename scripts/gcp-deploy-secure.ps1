# Hardened Cloud Run deploy: dedicated SA, secrets from Secret Manager, VPC/NAT egress.
# Non-secret env values are read from ../.env.yaml; secrets come from Secret Manager.
$ErrorActionPreference = 'Stop'
$root    = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envYaml = Join-Path $root '.env.yaml'
if (-not (Test-Path $envYaml)) { throw ".env.yaml not found - create it first." }

$map = @{}
foreach ($ln in Get-Content $envYaml) {
  if ($ln -match '^\s*([A-Z_]+):\s*"?(.*?)"?\s*$') { $map[$Matches[1]] = $Matches[2] }
}

$SA      = 'fairford-run@fair-ford-pharma.iam.gserviceaccount.com'
$secrets = 'MONGO_URI=MONGO_URI:latest,JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,CLOUDINARY_API_KEY=CLOUDINARY_API_KEY:latest,CLOUDINARY_API_SECRET=CLOUDINARY_API_SECRET:latest,EMAIL_PASS=EMAIL_PASS:latest'
<<<<<<< HEAD
$envVars = "NODE_ENV=production,FRONTEND_URL=https://fairfordpharma.com,JWT_EXPIRES_IN=1d,CLOUDINARY_CLOUD_NAME=$($map['CLOUDINARY_CLOUD_NAME']),EMAIL_USER=$($map['EMAIL_USER']),ADMIN_EMAIL=$($map['ADMIN_EMAIL'])"

# ── Razorpay (optional) ───────────────────────────────────────────────────────
# Wired in only when BOTH halves are available, so a deploy never fails just
# because online payment hasn't been set up yet — the app disables online pay on
# its own and cash-on-delivery keeps working.
#   Create/rotate the secret with:
#     "<secret>" | gcloud secrets create RAZORPAY_KEY_SECRET --data-file=-
#     "<secret>" | gcloud secrets versions add RAZORPAY_KEY_SECRET --data-file=-
# RAZORPAY_KEY_ID is public (it ships to the browser), so it rides in .env.yaml.
# NB: a missing secret makes gcloud write to stderr, and under
# $ErrorActionPreference='Stop' PowerShell turns that into a terminating
# NativeCommandError — which aborted the whole deploy. Probe it with the error
# preference relaxed and judge the result by $LASTEXITCODE instead.
$hasRzpSecret = $false
$prevEAP = $ErrorActionPreference
try {
  $ErrorActionPreference = 'SilentlyContinue'
  gcloud secrets describe RAZORPAY_KEY_SECRET --format='value(name)' 2>$null | Out-Null
  $hasRzpSecret = ($LASTEXITCODE -eq 0)
} catch {
  $hasRzpSecret = $false
} finally {
  $ErrorActionPreference = $prevEAP
  $global:LASTEXITCODE = 0
}
$rzpKeyId = $map['RAZORPAY_KEY_ID']

if ($hasRzpSecret -and $rzpKeyId) {
  $secrets += ',RAZORPAY_KEY_SECRET=RAZORPAY_KEY_SECRET:latest'
  $envVars += ",RAZORPAY_KEY_ID=$rzpKeyId"
  # Plain ASCII hyphens only — an em-dash here made Windows PowerShell 5.1
  # misparse the file (it doesn't reliably detect UTF-8 without a BOM) and
  # garbled this Write-Host's output on a live run (2026-08-04).
  if ($rzpKeyId -like 'rzp_live_*') { Write-Host "[razorpay] LIVE keys - real money will be charged" -ForegroundColor Yellow }
  else { Write-Host "[razorpay] TEST keys - payments will be simulated, no money collected" -ForegroundColor Yellow }
} else {
  Write-Host "[razorpay] not configured (secret: $hasRzpSecret, key id: $([bool]$rzpKeyId)) - deploying with online payment DISABLED; COD unaffected." -ForegroundColor Yellow
}
=======
$envVars = "NODE_ENV=production,FRONTEND_URL=https://fairfordpharma.com,JWT_EXPIRES_IN=7d,CLOUDINARY_CLOUD_NAME=$($map['CLOUDINARY_CLOUD_NAME']),EMAIL_USER=$($map['EMAIL_USER']),ADMIN_EMAIL=$($map['ADMIN_EMAIL'])"
>>>>>>> 7b815741 (final version all change done by tushar)

Push-Location $root
try {
  gcloud run deploy fairford-pharma `
    --source . `
    --region asia-south1 `
    --allow-unauthenticated `
    --service-account $SA `
    --min-instances 1 `
    --network default --subnet default --vpc-egress all-traffic `
    --set-secrets $secrets `
    --set-env-vars $envVars
} finally { Pop-Location }
