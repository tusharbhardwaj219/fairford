# Optional finisher — HTTP(:80) -> HTTPS(:443) redirect for the Fair Ford load balancer.
# Today only the :443 forwarding rule exists, so http://fairfordpharma.com just fails to
# connect. This adds a port-80 listener on the SAME LB IP that 301-redirects to https://.
# Re-running prints "already exists" errors for existing resources (harmless).

# 1) Redirect url-map (301 -> https, same host/path). Written to a temp YAML so PowerShell
#    quoting can't mangle it, then imported.
$yaml = @'
name: fairford-http-redirect
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  stripQuery: false
'@
$tmp = Join-Path $env:TEMP 'fairford-http-redirect.yaml'
$yaml | Out-File -FilePath $tmp -Encoding ascii

Write-Host "1) Import redirect url-map"
gcloud compute url-maps import fairford-http-redirect --global --source=$tmp --quiet

Write-Host "`n2) Target HTTP proxy on the redirect url-map"
gcloud compute target-http-proxies create fairford-http-proxy --url-map=fairford-http-redirect --global

Write-Host "`n3) Port-80 forwarding rule on the existing LB IP (fairford-lb-ip)"
gcloud compute forwarding-rules create fairford-fr-http --global --target-http-proxy=fairford-http-proxy --address=fairford-lb-ip --ports=80 --load-balancing-scheme=EXTERNAL_MANAGED

Write-Host "`n--- done. Test:  curl.exe -I http://fairfordpharma.com  -> expect '301' + 'location: https://...' ---"
