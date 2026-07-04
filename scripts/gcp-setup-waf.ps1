# Phase 6 — Cloud Armor WAF policy for the Fair Ford load balancer.
# Uses literal double-quoted expressions (WITH spaces) — the form PowerShell passes to gcloud
# correctly. Re-running prints "already exists" errors for existing rules, which is harmless.
$policy = 'fairford-armor'

Write-Host "1) policy + Adaptive Protection (L7 DDoS)"
gcloud compute security-policies create $policy --description="Fair Ford WAF" 2>$null
gcloud compute security-policies update $policy --enable-layer7-ddos-defense 2>$null

Write-Host "2) OWASP preconfigured rules at sensitivity 1 (enforce / deny-403)"
gcloud compute security-policies rules create 1000 --security-policy=$policy --expression="evaluatePreconfiguredWaf('sqli-v33-stable', {'sensitivity': 1})" --action=deny-403
gcloud compute security-policies rules create 1010 --security-policy=$policy --expression="evaluatePreconfiguredWaf('xss-v33-stable', {'sensitivity': 1})" --action=deny-403
gcloud compute security-policies rules create 1020 --security-policy=$policy --expression="evaluatePreconfiguredWaf('lfi-v33-stable', {'sensitivity': 1})" --action=deny-403
gcloud compute security-policies rules create 1030 --security-policy=$policy --expression="evaluatePreconfiguredWaf('rce-v33-stable', {'sensitivity': 1})" --action=deny-403

Write-Host "3) per-IP rate limit (>120 req/min -> 429, 10-min ban)"
gcloud compute security-policies rules create 2000 --security-policy=$policy --action=rate-based-ban --expression="true" --rate-limit-threshold-count=120 --rate-limit-threshold-interval-sec=60 --conform-action=allow --exceed-action=deny-429 --enforce-on-key=IP --ban-duration-sec=600

Write-Host "--- done. Verify: gcloud compute security-policies describe $policy --format=""yaml(rules)"" ---"
