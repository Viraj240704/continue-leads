# RDS PostgreSQL 16 with pgvector. pgvector ships with RDS PG 15+; it is enabled by
# running `CREATE EXTENSION vector;` in migration 0001 (already in the app repo).

# Constrains RDS placement to the private subnets — no public IP, no internet route.
resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.name}-db-subnets" }
}

# Parameter group: allow the pgvector + pgcrypto libraries and sane logging.
resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # log slow queries > 1s
  }
  # RLS relies on set_config('app.tenant_id', ...); no special param needed.
  tags = { Name = "${local.name}-pg16" }
}

# Multi-AZ instance with encrypted, autoscaling storage. backup_retention_period > 0
# enables point-in-time recovery; deletion protection and final snapshots are only
# enforced in prod so staging can be torn down freely.
resource "aws_db_instance" "main" {
  identifier     = "${local.name}-db"
  engine         = "postgres"
  engine_version = "16.4"

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 5 # storage autoscaling
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.data.arn

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = false

  multi_az                     = var.db_multi_az
  backup_retention_period      = 7
  backup_window                = "07:00-08:00"
  maintenance_window           = "Mon:08:30-Mon:09:30"
  performance_insights_enabled = true
  auto_minor_version_upgrade   = true

  deletion_protection       = var.environment == "prod"
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${local.name}-db-final" : null

  tags = { Name = "${local.name}-db" }
}
