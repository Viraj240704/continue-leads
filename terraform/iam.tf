# IAM roles for ECS: an execution role (pull image, read secrets, write logs) and
# a task role (least-privilege app access to S3, KMS, CloudFront invalidation).

# Trust policy shared by both roles: only the ECS tasks service can assume them.
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ---- Execution role ----
resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name}-ecs-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Beyond the managed execution policy, the execution role also needs to read the
# app secret and decrypt it with the data KMS key (both happen before the container starts).
data "aws_iam_policy_document" "ecs_execution_extra" {
  statement {
    sid       = "ReadAppSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [aws_secretsmanager_secret.app.arn]
  }
  statement {
    sid       = "DecryptSecrets"
    actions   = ["kms:Decrypt"]
    resources = [aws_kms_key.data.arn]
  }
}

resource "aws_iam_role_policy" "ecs_execution_extra" {
  name   = "${local.name}-ecs-exec-extra"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_extra.json
}

# ---- Task role (the running app) ----
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# Runtime permissions for the app itself: read/write the site S3 buckets, encrypt/decrypt
# PII with the dedicated PII key, and invalidate CloudFront after publishing.
data "aws_iam_policy_document" "ecs_task" {
  statement {
    sid     = "S3SiteStore"
    actions = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
    resources = [
      aws_s3_bucket.assets.arn, "${aws_s3_bucket.assets.arn}/*",
      aws_s3_bucket.preview.arn, "${aws_s3_bucket.preview.arn}/*",
      aws_s3_bucket.live.arn, "${aws_s3_bucket.live.arn}/*",
    ]
  }
  statement {
    sid       = "PiiCrypto"
    actions   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.pii.arn]
  }
  statement {
    sid       = "CloudFrontInvalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = ["*"] # invalidation is not resource-scopable in IAM
  }
}

resource "aws_iam_role_policy" "ecs_task" {
  name   = "${local.name}-ecs-task"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_task.json
}
