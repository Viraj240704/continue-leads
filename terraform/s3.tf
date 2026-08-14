# Three buckets: assets (brand logos/images), preview (private staged sites), live
# (published static sites, served via CloudFront OAC). All private; no public ACLs.

locals {
  buckets = {
    assets  = "${local.name}-assets-${local.account}"
    preview = "${local.name}-preview-${local.account}"
    live    = "${local.name}-live-${local.account}"
  }
}

resource "aws_s3_bucket" "assets" {
  bucket = local.buckets.assets
  tags   = { Name = local.buckets.assets, Role = "assets" }
}
resource "aws_s3_bucket" "preview" {
  bucket = local.buckets.preview
  tags   = { Name = local.buckets.preview, Role = "preview" }
}
resource "aws_s3_bucket" "live" {
  bucket = local.buckets.live
  tags   = { Name = local.buckets.live, Role = "live" }
}

# Block all public access on every bucket.
resource "aws_s3_bucket_public_access_block" "all" {
  for_each                = { assets = aws_s3_bucket.assets.id, preview = aws_s3_bucket.preview.id, live = aws_s3_bucket.live.id }
  bucket                  = each.value
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Default SSE-KMS encryption.
resource "aws_s3_bucket_server_side_encryption_configuration" "all" {
  for_each = { assets = aws_s3_bucket.assets.id, preview = aws_s3_bucket.preview.id, live = aws_s3_bucket.live.id }
  bucket   = each.value
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.data.arn
    }
    bucket_key_enabled = true
  }
}

# Only the live (published) bucket needs version history so content can be rolled back.
resource "aws_s3_bucket_versioning" "live" {
  bucket = aws_s3_bucket.live.id
  versioning_configuration { status = "Enabled" }
}

# Expire stale preview artifacts after 30 days.
resource "aws_s3_bucket_lifecycle_configuration" "preview" {
  bucket = aws_s3_bucket.preview.id
  rule {
    id     = "expire-previews"
    status = "Enabled"
    filter {} # apply to all objects in the preview bucket
    expiration { days = 30 }
  }
}

# ---- ECR repository for the admin app image ----
resource "aws_ecr_repository" "app" {
  name                 = "${local.name}-admin"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.data.arn
  }
  tags = { Name = "${local.name}-admin" }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 15 images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 15 }
      action       = { type = "expire" }
    }]
  })
}
