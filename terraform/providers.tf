# Primary provider — all region-local resources (VPC, IAM, KMS, RDS, ECS, ...) use this.
provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "continue-leads"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront + WAFv2 (CLOUDFRONT scope) must be managed in us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "continue-leads"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Manages DNS records/zone settings for the root domain.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
