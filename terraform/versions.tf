terraform {
  required_version = ">= 1.6.0"

  # Pinned provider versions so `terraform init` is reproducible across machines/CI.
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Remote state — create this bucket + lock table once, out of band (see docs/BOOTSTRAP.md),
  # then uncomment and run `terraform init`.
  # backend "s3" {
  #   bucket         = "continue-leads-tfstate"
  #   key            = "phase1/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "continue-leads-tflock"
  #   encrypt        = true
  # }
}
