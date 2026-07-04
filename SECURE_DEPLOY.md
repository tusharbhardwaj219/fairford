# Fair Ford Pharma — Hardened Cloud Run Deployment

Full security build. Concrete values: project **`fair-ford-pharma`**, region **`asia-south1`**, domain **`fairfordpharma.com`**.

```
Internet
  → Global External HTTPS Load Balancer  (Google-managed SSL for apex + www)
    → Cloud Armor WAF  (OWASP CRS: SQLi/XSS/LFI, edge rate-limit, L7 DDoS defense)
      → Serverless NEG → Cloud Run "fairford-pharma"
           • ingress: internal-and-cloud-load-balancing  (public run.app URL blocked)
           • dedicated least-privilege service account
           • secrets from Secret Manager (not plain env vars)
           • egress: Direct VPC → Cloud NAT → static IP
             → MongoDB Atlas allowlist = ONLY that static IP
```

> Run everything from the repo root (`...\main`) in your gcloud-authed PowerShell.

---

## Phase 1 — Enable APIs
```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com compute.googleapis.com containerscanning.googleapis.com
```

## Phase 2 — Secret Manager + dedicated service account
```powershell
# 2a. Load the 6 real secrets from .env.yaml into Secret Manager (no manual copy):
.\scripts\gcp-create-secrets.ps1

# 2b. Create a least-privilege runtime service account:
gcloud iam service-accounts create fairford-run --display-name="Fair Ford Cloud Run runtime"

# 2c. Grant it read-only access to each secret:
$SA="fairford-run@fair-ford-pharma.iam.gserviceaccount.com"
foreach ($s in 'MONGO_URI','JWT_SECRET','JWT_REFRESH_SECRET','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','EMAIL_PASS') {
  gcloud secrets add-iam-policy-binding $s --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
}
```

## Phase 3 — Static egress IP (Cloud NAT)
```powershell
gcloud compute addresses create fairford-nat-ip --region=asia-south1
gcloud compute routers create fairford-router --network=default --region=asia-south1
gcloud compute routers nats create fairford-nat --router=fairford-router --region=asia-south1 --nat-all-subnet-ip-ranges --nat-external-ip-pool=fairford-nat-ip
# note this IP for Atlas (Phase 5):
gcloud compute addresses describe fairford-nat-ip --region=asia-south1 --format="value(address)"
```

## Phase 4 — First secure deploy (ingress still open, for smoke test)
```powershell
.\scripts\gcp-deploy-secure.ps1
```
This pulls non-secret env (cloud name, EMAIL_USER, ADMIN_EMAIL) from `.env.yaml`, wires the
6 secrets via `--set-secrets`, runs under the dedicated SA, `--min-instances 1`, and routes
egress through the VPC/NAT. On success it prints the `*.run.app` Service URL → smoke-test it.

## Phase 5 — Lock Atlas to the static IP
Atlas → Network Access → add the **NAT IP** from Phase 3 → **remove `0.0.0.0/0`**.
Re-hit `/api/health` to confirm the DB is still reachable through the NAT IP.

## Phase 6 — Cloud Armor WAF policy
```powershell
gcloud compute security-policies create fairford-armor --description="Fair Ford WAF"
gcloud compute security-policies update fairford-armor --enable-layer7-ddos-defense
gcloud compute security-policies rules create 1000 --security-policy=fairford-armor --expression="evaluatePreconfiguredWaf('sqli-v33-stable')" --action=deny-403
gcloud compute security-policies rules create 1010 --security-policy=fairford-armor --expression="evaluatePreconfiguredWaf('xss-v33-stable')" --action=deny-403
gcloud compute security-policies rules create 1020 --security-policy=fairford-armor --expression="evaluatePreconfiguredWaf('lfi-v33-stable')" --action=deny-403
gcloud compute security-policies rules create 2000 --security-policy=fairford-armor --action=rate-based-ban --expression="true" --rate-limit-threshold-count=120 --rate-limit-threshold-interval-sec=60 --conform-action=allow --exceed-action=deny-429 --enforce-on-key=IP --ban-duration-sec=600
```

## Phase 7 — Global HTTPS Load Balancer
```powershell
gcloud compute network-endpoint-groups create fairford-neg --region=asia-south1 --network-endpoint-type=serverless --cloud-run-service=fairford-pharma
gcloud compute backend-services create fairford-backend --global --load-balancing-scheme=EXTERNAL_MANAGED --security-policy=fairford-armor
gcloud compute backend-services add-backend fairford-backend --global --network-endpoint-group=fairford-neg --network-endpoint-group-region=asia-south1
gcloud compute addresses create fairford-lb-ip --global
gcloud compute ssl-certificates create fairford-cert --global --domains=fairfordpharma.com,www.fairfordpharma.com
gcloud compute url-maps create fairford-urlmap --default-service=fairford-backend
gcloud compute target-https-proxies create fairford-https-proxy --url-map=fairford-urlmap --ssl-certificates=fairford-cert
gcloud compute forwarding-rules create fairford-fr-https --global --target-https-proxy=fairford-https-proxy --address=fairford-lb-ip --ports=443 --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute addresses describe fairford-lb-ip --global --format="value(address)"   # ← the LB IP for DNS
```

## Phase 8 — DNS + managed cert
At your registrar, point `fairfordpharma.com` and `www.fairfordpharma.com` **A records** to the LB IP.
Google issues the cert once DNS resolves (15–60 min). Check:
```powershell
gcloud compute ssl-certificates describe fairford-cert --global --format="value(managed.status,managed.domainStatus)"
```
Wait for `ACTIVE`.

## Phase 9 — Lock Cloud Run to the load balancer only
```powershell
gcloud run services update fairford-pharma --region asia-south1 --ingress internal-and-cloud-load-balancing
```

## Phase 10 — Monitoring / detection
- **Security Command Center** — enable in console (Premium adds threat detection + vuln scanning).
- **Container scanning** — enabled in Phase 1; review CVEs in Artifact Registry per build.
- **Alerting** — create an uptime check on `https://fairfordpharma.com/api/health` and alert on 5xx / high latency.

## Smoke test (via the domain, once cert is ACTIVE)
`/api/health` → admin login → retailer login → place a COD order → confirm distributor email.

## Notes
- This build incurs steady cost (LB forwarding rule, Cloud NAT, static IPs, min-instance) — expected for a hardened always-on setup.
- App-level items intentionally deferred: JWT-in-localStorage → httpOnly cookies, and moving rate-limit/lockout/token-blacklist to a shared store so they hold under autoscaling.
