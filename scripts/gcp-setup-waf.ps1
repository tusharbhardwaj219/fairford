# Phase 6 — Cloud Armor WAF policy for the Fair Ford load balancer. Idempotent.
# OWASP preconfigured rules at sensitivity 1 (lowest paranoia = fewest false positives)
# in enforce mode, plus per-IP rate limiting and Adaptive Protection (L7 DDoS).
$policy = 'fairford-armor'

Write-Host "1) create policy $policy"
gcloud compute security-policies create $policy --description="Fair Ford WAF" 2>&1 | Out-Null

Write-Host "2) enable Adaptive Protection (L7 DDoS)"
gcloud compute security-policies update $policy --enable-layer7-ddos-defense 2>&1 | Out-Null

# NB: expressions have NO spaces so PowerShell passes them as one argument cleanly.
$wafRules = [ordered]@{
  1000 = "evaluatePreconfiguredWaf('sqli-v33-stable',{'sensitivity':1})"
  1010 = "evaluatePreconfiguredWaf('xss-v33-stable',{'sensitivity':1})"
  1020 = "evaluatePreconfiguredWaf('lfi-v33-stable',{'sensitivity':1})"
  1030 = "evaluatePreconfiguredWaf('rce-v33-stable',{'sensitivity':1})"
}
Write-Host "3) add OWASP rules (SQLi / XSS / LFI / RCE) at sensitivity 1"
foreach ($prio in $wafRules.Keys) {
  $expr = $wafRules[$prio]
  gcloud compute security-policies rules create $prio --security-policy=$policy --expression=$expr --action=deny-403 2>&1 | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host "   OK  rule $prio  ($($expr.Split("'")[1]))" } else { Write-Host "   ..  rule $prio  (already exists / skipped)" }
}

Write-Host "4) add rate-limit rule 2000 (>120 req/min per IP -> 429, 10-min ban)"
gcloud compute security-policies rules create 2000 --security-policy=$policy --action=rate-based-ban --expression="true" --rate-limit-threshold-count=120 --rate-limit-threshold-interval-sec=60 --conform-action=allow --exceed-action=deny-429 --enforce-on-key=IP --ban-duration-sec=600 2>&1 | Out-Null

Write-Host "--- WAF policy '$policy' ready. Inspect: gcloud compute security-policies describe $policy ---"
