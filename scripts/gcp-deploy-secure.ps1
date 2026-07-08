# Hardened Cloud Run deploy: dedicated SA, secrets from Secret Manager, VPC/NAT egress.
# Non-secret env values are read from ../.env.yaml; secrets come from Secret Manager.
$ErrorActionPreference = 'Stop'
$root    = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envYaml = Join-Path $root '.env.yaml'
<<<<<<< HEAD
if (-not (Test-Path $envYaml)) { throw ".env.yaml not found - create it first." }
=======
if (-not (Test-Path $envYaml)) { throw ".env.yaml not found — create it first." }
>>>>>>> 35e2b82162dd082c447f74763dfbb7df6659a189

$map = @{}
foreach ($ln in Get-Content $envYaml) {
  if ($ln -match '^\s*([A-Z_]+):\s*"?(.*?)"?\s*$') { $map[$Matches[1]] = $Matches[2] }
}

$SA      = 'fairford-run@fair-ford-pharma.iam.gserviceaccount.com'
$secrets = 'MONGO_URI=MONGO_URI:latest,JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,CLOUDINARY_API_KEY=CLOUDINARY_API_KEY:latest,CLOUDINARY_API_SECRET=CLOUDINARY_API_SECRET:latest,EMAIL_PASS=EMAIL_PASS:latest'
$envVars = "NODE_ENV=production,FRONTEND_URL=https://fairfordpharma.com,JWT_EXPIRES_IN=7d,CLOUDINARY_CLOUD_NAME=$($map['CLOUDINARY_CLOUD_NAME']),EMAIL_USER=$($map['EMAIL_USER']),ADMIN_EMAIL=$($map['ADMIN_EMAIL'])"

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
