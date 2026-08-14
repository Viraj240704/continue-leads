# Customer-managed KMS keys: one for data-at-rest (RDS/S3), one for application PII.

# Encrypts general data-at-rest (RDS storage, S3 buckets). Rotation enabled = AWS
# rotates the backing key material yearly without changing the key ID/ARN.
resource "aws_kms_key" "data" {
  description             = "${local.name} data-at-rest (RDS, S3)"
  deletion_window_in_days = 14
  enable_key_rotation     = true
  tags                    = { Name = "${local.name}-kms-data" }
}

resource "aws_kms_alias" "data" {
  name          = "alias/${local.name}-data"
  target_key_id = aws_kms_key.data.key_id
}

# Separate key so PII encryption can be audited/rotated/revoked independently of
# general data-at-rest — narrows blast radius if this key is ever compromised.
resource "aws_kms_key" "pii" {
  description             = "${local.name} application PII encryption"
  deletion_window_in_days = 14
  enable_key_rotation     = true
  tags                    = { Name = "${local.name}-kms-pii" }
}

resource "aws_kms_alias" "pii" {
  name          = "alias/${local.name}-pii"
  target_key_id = aws_kms_key.pii.key_id
}
