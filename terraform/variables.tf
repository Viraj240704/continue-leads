variable "aws_region" {
  description = "Primary AWS region."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (staging | prod)."
  type        = string
  default     = "staging"
}

variable "name_prefix" {
  description = "Prefix for resource names."
  type        = string
  default     = "cl"
}

# ---- Networking ----
# CIDR block for the VPC; subnets are carved out of this range in network.tf.
variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to span."
  type        = number
  default     = 2
}

# ---- Database ----
# Initial database name created on the RDS instance.
variable "db_name" {
  type    = string
  default = "continue_leads"
}

# Master username for the RDS instance.
variable "db_username" {
  type    = string
  default = "cl_app"
}

# RDS instance size; bump for prod workloads.
variable "db_instance_class" {
  type    = string
  default = "db.t4g.medium"
}

# Allocated storage in GB.
variable "db_allocated_storage" {
  type    = number
  default = 20
}

# Whether RDS runs a standby replica in a second AZ for automatic failover.
variable "db_multi_az" {
  type    = bool
  default = true
}

# ---- App / ECS ----
variable "app_image" {
  description = "Full ECR image URI:tag for the admin app. Set by CI on deploy."
  type        = string
  default     = "" # empty on first apply; CI supplies it thereafter
}

# ECS task CPU units (1024 = 1 vCPU).
variable "app_cpu" {
  type    = number
  default = 512
}

# ECS task memory in MB.
variable "app_memory" {
  type    = number
  default = 1024
}

# Number of ECS task replicas to run behind the ALB.
variable "app_desired_count" {
  type    = number
  default = 2
}

# Port the app container listens on; the ALB and app security group target this port.
variable "app_port" {
  type    = number
  default = 3000
}

# ---- DNS / TLS (Cloudflare + ACM) ----
# Master switch for the public domain + TLS layer. When false (internal smoke test),
# no ACM certs, no Cloudflare DNS records, and no HTTPS listener are created — the admin
# app is served over plain HTTP at the ALB's AWS-assigned DNS name, and CloudFront uses
# its default *.cloudfront.net certificate. Flip to true once a real cloudflare_api_token
# is set to provision the custom domain (admin.<root>, *.sites.<root>) with TLS.
variable "enable_tls" {
  type    = bool
  default = false
}

variable "root_domain" {
  description = "Apex domain managed in Cloudflare, e.g. continueleads.com"
  type        = string
}

variable "admin_subdomain" {
  description = "Subdomain for the admin app, e.g. admin -> admin.continueleads.com"
  type        = string
  default     = "admin"
}

# Cloudflare zone ID for root_domain — found on the zone's Overview page in the Cloudflare dashboard.
variable "cloudflare_zone_id" {
  type = string
}

# Cloudflare API token scoped to Zone.DNS edit for the above zone.
# Only required when enable_tls = true; left blank for the HTTP smoke test.
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
  default   = ""
}

# ---- Application secrets (populated into Secrets Manager) ----
# Signs/encrypts app sessions; generate a long random string per environment.
variable "session_secret" {
  type      = string
  sensitive = true
}

# Anthropic API key for the app's AI features; blank disables them.
variable "anthropic_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

# Voyage AI API key for embeddings; blank disables the feature.
variable "voyage_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

# Sentry DSN for error reporting; blank disables Sentry.
variable "sentry_dsn" {
  type    = string
  default = ""
}

variable "alert_emails" {
  description = "Emails subscribed to the alerts SNS topics for budget + CloudWatch notifications. Each recipient must confirm the AWS subscription email once."
  type        = list(string)
  default     = []
}

variable "monthly_budget_usd" {
  description = "Monthly cost budget in USD. Alarms fire against this; the hard-cap action triggers at 100%."
  type        = number
  default     = 35
}

variable "budget_enforce" {
  description = "If true, at 100% of budget AWS Budgets auto-attaches a deny policy to the developer role to block new billable resources (closest thing to a hard cap)."
  type        = bool
  default     = true
}

variable "developer_trust_arns" {
  description = "IAM principal ARNs allowed to assume the developer role. Defaults to the account root (any IAM user granted sts:AssumeRole)."
  type        = list(string)
  default     = []
}

# ---- GitHub Actions OIDC (CI/CD) ----
variable "github_repo" {
  description = "GitHub repo (owner/name) allowed to assume the CI deploy role via OIDC."
  type        = string
  default     = "Continue-Leads/continue-leads"
}

variable "github_deploy_refs" {
  description = "Git refs on which the CI role may be assumed (matched against the OIDC `sub` claim)."
  type        = list(string)
  default     = ["refs/heads/staging"]
}
