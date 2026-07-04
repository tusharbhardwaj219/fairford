# Phase 7 — Global external HTTPS Application Load Balancer for fairfordpharma.com.
# Fronts Cloud Run with the Cloud Armor WAF + a Google-managed SSL cert.
# Re-running prints "already exists" errors for existing resources (harmless).
$region = 'asia-south1'; $svc = 'fairford-pharma'; $policy = 'fairford-armor'

Write-Host "1) Serverless NEG -> Cloud Run ($svc)"
gcloud compute network-endpoint-groups create fairford-neg --region=$region --network-endpoint-type=serverless --cloud-run-service=$svc

Write-Host "`n2) Backend service (global, EXTERNAL_MANAGED) + attach WAF + add NEG"
gcloud compute backend-services create fairford-backend --global --load-balancing-scheme=EXTERNAL_MANAGED
gcloud compute backend-services add-backend fairford-backend --global --network-endpoint-group=fairford-neg --network-endpoint-group-region=$region
gcloud compute backend-services update fairford-backend --global --security-policy=$policy

Write-Host "`n3) Reserve a global LB IP"
gcloud compute addresses create fairford-lb-ip --global

Write-Host "`n4) Google-managed SSL cert (apex + www)"
gcloud compute ssl-certificates create fairford-cert --global --domains=fairfordpharma.com,www.fairfordpharma.com

Write-Host "`n5) URL map -> backend"
gcloud compute url-maps create fairford-urlmap --default-service=fairford-backend

Write-Host "`n6) Target HTTPS proxy (url-map + cert)"
gcloud compute target-https-proxies create fairford-https-proxy --url-map=fairford-urlmap --ssl-certificates=fairford-cert

Write-Host "`n7) Forwarding rule :443"
gcloud compute forwarding-rules create fairford-fr-https --global --target-https-proxy=fairford-https-proxy --address=fairford-lb-ip --ports=443 --load-balancing-scheme=EXTERNAL_MANAGED

Write-Host "`n================================================================"
Write-Host " LOAD BALANCER IP  (point fairfordpharma.com + www here in DNS):"
gcloud compute addresses describe fairford-lb-ip --global --format="value(address)"
Write-Host " SSL cert status  (stays PROVISIONING until DNS resolves):"
gcloud compute ssl-certificates describe fairford-cert --global --format="value(managed.status)"
Write-Host "================================================================"
Write-Host " (HTTP->HTTPS redirect is added as a quick follow-up once HTTPS is confirmed.)"
