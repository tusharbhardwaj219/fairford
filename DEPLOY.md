# Fair Ford Pharma — Go-Live on Google Cloud Run

> **Going for the hardened build?** Use [`SECURE_DEPLOY.md`](SECURE_DEPLOY.md) — Secret Manager,
> Cloud Armor WAF, HTTPS load balancer, VPC/NAT static IP with Atlas locked down, LB-only ingress.
> This file is the simpler baseline (env-vars file, direct Cloud Run, Atlas `0.0.0.0/0`).

One Node process (in `backend/`) serves the API **and** the static frontend/images.
We deploy it as a container on **Cloud Run** — Cloud Build compiles the `Dockerfile`
in the cloud (no local Docker needed), and Cloud Run gives automatic HTTPS + scaling.

External services stay as-is: **MongoDB Atlas** (rotated cluster), **Cloudinary**, **Gmail**.

---

## Phase 1 — GCP account + project + billing

1. Go to <https://console.cloud.google.com> and sign in with a Google account. New
   accounts get **$300 free credit**.
2. Top bar → project dropdown → **New Project** → name it e.g. `fairford-pharma` →
   note the **Project ID** (e.g. `fairford-pharma-470112`).
3. Enable billing: **Billing** → link a payment method to the project. (Cloud Run is
   near-free at low traffic, but billing must be enabled.)

## Phase 2 — Install the gcloud CLI (Windows)

1. Download the installer: <https://cloud.google.com/sdk/docs/install> → run it.
2. Open a **new** PowerShell window and confirm: `gcloud version`
3. Log in and select the project:
   ```powershell
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

## Phase 3 — Enable the required APIs

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Phase 4 — Security prep (do NOT skip)

1. **Rotate the Gmail App Password** — it's the one leaked secret still in use.
   Google Account → Security → 2-Step Verification → App passwords → delete old, create new.
2. **Create the secrets file** (kept out of git + out of the image):
   - Copy `.env.yaml.example` → `.env.yaml`
   - Fill every value from `backend/.env`, and use the **new** Gmail app password for `EMAIL_PASS`.
   - `.env.yaml` is already gitignored — keep it that way.

## Phase 5 — MongoDB Atlas: allow Cloud Run

Cloud Run has **dynamic outbound IPs**, so in Atlas → **Network Access** → add
`0.0.0.0/0` (access stays gated by the rotated DB credentials). Do this **before**
deploying — the app calls `process.exit(1)` if it can't reach Mongo, which would
fail the first deploy.

## Phase 6 — Deploy to Cloud Run

Run from the **repo root** (the folder containing `Dockerfile`, `backend/`, `frontend/`, `image/`):

```powershell
gcloud run deploy fairford-pharma `
  --source . `
  --region asia-south1 `
  --allow-unauthenticated `
  --env-vars-file .env.yaml
```

- `asia-south1` = Mumbai (lowest latency for India).
- `--allow-unauthenticated` = it's a public website.
- First run builds the image (2–4 min) and prints a **Service URL** like
  `https://fairford-pharma-xxxxxxxxxx-el.a.run.app`.

## Phase 7 — Smoke test (on the run.app URL)

- `.../api/health` → `{ "success": true, "status": "OK", "env": "production" }`
- Home + product listing load
- Admin login (`/admin.html`) → redirects to `/superadmin.html`
- Retailer login → `/retailer.html`; edit shop address; browse products
- Place a COD order end-to-end; stock decrements; admin sees it
- Confirm the distributor order-notification email arrives (validates the new `EMAIL_PASS`)

## Phase 8 — Custom domain (fairfordpharma.com)

You can launch on the run.app URL and add the domain anytime. Two options:

- **A. Cloud Run domain mapping (free, simplest — if supported in your region):**
  ```powershell
  gcloud beta run domain-mappings create --service fairford-pharma --domain fairfordpharma.com --region asia-south1
  ```
  It prints DNS records (usually a CNAME / A+AAAA) to add at your registrar. Repeat for `www`.
- **B. Global HTTPS Load Balancer** (works in every region, ~$18/mo) — use this if
  domain mapping isn't available in `asia-south1`. I'll give the exact steps if we go this route.

After DNS propagates, Google issues the TLS cert automatically. The app's CORS
whitelist + sitemap already expect `fairfordpharma.com` and `www.fairfordpharma.com`.

## Phase 9 — Redeploys / updates

After any code change, re-run the same deploy command (it builds a new revision and
shifts traffic to it):
```powershell
gcloud run deploy fairford-pharma --source . --region asia-south1 --allow-unauthenticated --env-vars-file .env.yaml
```
To change only env vars later, edit them in the Cloud Run console, or:
`gcloud run services update fairford-pharma --region asia-south1 --env-vars-file .env.yaml`

## Notes & hardening

- **Cost:** scales to zero when idle; you pay per request/CPU-second. Set a max to cap
  spend: `--max-instances 3`. Optionally `--min-instances 1` to avoid cold starts (small always-on cost).
- **Secrets hardening (optional):** move `.env.yaml` values into **Secret Manager** and
  reference them with `--set-secrets` instead of `--env-vars-file`.
- **Static Atlas IP (optional):** Direct VPC egress + Cloud NAT gives Cloud Run a fixed
  outbound IP so you can remove `0.0.0.0/0` from Atlas.
- `npm run seed` / `seed:fresh` seed demo data; the prod cluster already has real data —
  `seed:fresh` WIPES everything, so don't run it against prod by accident.
- Collaborator **tushar**: after pulling, run `npm install` (node_modules is untracked now).
