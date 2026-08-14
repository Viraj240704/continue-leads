# Cloudflare DNS: admin subdomain -> ALB; wildcard preview/brand -> CloudFront.
# Records are DNS-only (not proxied) so ACM/ALB TLS terminates directly.

resource "cloudflare_record" "admin" {
  count   = var.enable_tls ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = var.admin_subdomain
  type    = "CNAME"
  content = aws_lb.app.dns_name
  ttl     = 1
  proxied = false
}

# Wildcard for published brand sites served by CloudFront (e.g. *.sites.<domain>).
resource "cloudflare_record" "sites_wildcard" {
  count   = var.enable_tls ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = "*.sites"
  type    = "CNAME"
  content = aws_cloudfront_distribution.live.domain_name
  ttl     = 1
  proxied = false
}
