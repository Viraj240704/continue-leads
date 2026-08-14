# CloudFront distribution serving the published static sites from the live S3 bucket
# via Origin Access Control (bucket stays private). WAF attached at the edge.

# Wildcard TLS cert for per-site subdomains (*.sites.<root>). CloudFront requires the
# cert in us-east-1, DNS-validated through Cloudflare (same pattern as the admin cert).
# Only created in TLS mode; in HTTP smoke-test mode CloudFront falls back to its default
# *.cloudfront.net certificate (see viewer_certificate below).
resource "aws_acm_certificate" "sites" {
  count             = var.enable_tls ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = local.sites_wildcard
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
  tags = { Name = "${local.name}-sites-cert" }
}

# Single-domain (wildcard) cert → exactly one validation record; count avoids the
# for_each "unknown keys" problem at plan time.
resource "cloudflare_record" "sites_cert_validation" {
  count   = var.enable_tls ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = tolist(aws_acm_certificate.sites[0].domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.sites[0].domain_validation_options)[0].resource_record_type
  content = trimsuffix(tolist(aws_acm_certificate.sites[0].domain_validation_options)[0].resource_record_value, ".")
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "sites" {
  count                   = var.enable_tls ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.sites[0].arn
  validation_record_fqdns = [for r in cloudflare_record.sites_cert_validation : r.hostname]
}

resource "aws_cloudfront_origin_access_control" "live" {
  name                              = "${local.name}-live-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "live" {
  enabled             = true
  comment             = "${local.name} live sites"
  default_root_object = "index.html"
  aliases             = var.enable_tls ? [local.sites_wildcard] : [] # custom domain only in TLS mode
  price_class         = "PriceClass_100"
  web_acl_id          = aws_wafv2_web_acl.cloudfront.arn

  origin {
    domain_name              = aws_s3_bucket.live.bucket_regional_domain_name
    origin_id                = "live-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.live.id
  }

  default_cache_behavior {
    target_origin_id       = "live-s3"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # AWS managed "CachingOptimized" policy.
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  # TLS mode: custom wildcard ACM cert. HTTP mode: CloudFront's default *.cloudfront.net cert.
  viewer_certificate {
    cloudfront_default_certificate = var.enable_tls ? null : true
    acm_certificate_arn            = one(aws_acm_certificate_validation.sites[*].certificate_arn)
    ssl_support_method             = var.enable_tls ? "sni-only" : null
    minimum_protocol_version       = var.enable_tls ? "TLSv1.2_2021" : null
  }

  tags = { Name = "${local.name}-live-cdn" }
}

# Allow only this CloudFront distribution to read the live bucket.
data "aws_iam_policy_document" "live_bucket" {
  statement {
    sid       = "AllowCloudFrontOAC"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.live.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.live.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "live" {
  bucket = aws_s3_bucket.live.id
  policy = data.aws_iam_policy_document.live_bucket.json
}
