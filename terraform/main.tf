# Shared locals + data sources. Resource definitions live in their topic files
# (network.tf, kms.tf, rds.tf, s3.tf, ecs.tf, ...).

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  name           = "${var.name_prefix}-${var.environment}" # e.g. "cl-staging" — used as the common resource-name prefix
  azs            = slice(data.aws_availability_zones.available.names, 0, var.az_count) # first N available AZs in the region
  fqdn           = "${var.admin_subdomain}.${var.root_domain}" # full hostname for the admin app, e.g. admin.continueleads.com
  sites_domain   = "sites.${var.root_domain}" # per-site subdomains live under *.sites.<root>
  sites_wildcard = "*.${local.sites_domain}"  # CloudFront alias + ACM SAN for published brand sites
  account        = data.aws_caller_identity.current.account_id # current AWS account ID, used in IAM resource ARNs

  # Default tags merged into every resource that references local.tags
  tags = {
    Project     = "continue-leads"
    Environment = var.environment
  }
}
