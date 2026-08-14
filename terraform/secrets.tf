# Application secrets in Secrets Manager as a single JSON document. The ECS task
# reads individual keys via `secrets` in the container definition (see ecs.tf).

# RDS master password. No special characters — some are rejected in RDS passwords
# and in the connection-string URI built below.
resource "random_password" "db" {
  length  = 32
  special = false
}

# The secret container; the actual key/value payload is the version below.
resource "aws_secretsmanager_secret" "app" {
  name       = "${local.name}/app"
  kms_key_id = aws_kms_key.data.arn
  tags       = { Name = "${local.name}-app-secret" }
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    # sslmode=no-verify: RDS enforces SSL (rds.force_ssl); node-postgres connects over TLS
    # without cert verification. Fixes both the app pool and the migration runner.
    DATABASE_URL      = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}?sslmode=no-verify"
    SESSION_SECRET    = var.session_secret
    ANTHROPIC_API_KEY = var.anthropic_api_key
    VOYAGE_API_KEY    = var.voyage_api_key
    SENTRY_DSN        = var.sentry_dsn
  })
}
