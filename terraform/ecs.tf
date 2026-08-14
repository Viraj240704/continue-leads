# ECS Fargate cluster + admin app service behind the ALB.

resource "aws_ecs_cluster" "main" {
  name = "${local.name}-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}-admin"
  retention_in_days = 30
  tags              = { Name = "${local.name}-app-logs" }
}

# The container image: use the provided image, or fall back to a public placeholder
# for the very first apply (before CI has pushed a real image). CI passes app_image.
locals {
  container_image = var.app_image != "" ? var.app_image : "public.ecr.aws/docker/library/busybox:latest"
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name}-admin"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.app_cpu
  memory                   = var.app_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name         = "admin"
    image        = local.container_image
    essential    = true
    portMappings = [{ containerPort = var.app_port, protocol = "tcp" }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      # ECS sets HOSTNAME to the container hostname; Next.js standalone binds to it, which
      # breaks the localhost container health check. Force binding to all interfaces.
      { name = "HOSTNAME", value = "0.0.0.0" },
      # Secure cookies require HTTPS; disable them for the HTTP smoke test so login/session works.
      { name = "COOKIE_SECURE", value = var.enable_tls ? "true" : "false" },
      { name = "CONTENT_PROVIDER", value = "claude" },
      { name = "EMBEDDINGS_DRIVER", value = "voyage" },
      { name = "STORAGE_DRIVER", value = "s3" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "S3_BUCKET", value = aws_s3_bucket.live.bucket },
      { name = "S3_ASSETS_BUCKET", value = aws_s3_bucket.assets.bucket },
      { name = "S3_PREVIEW_BUCKET", value = aws_s3_bucket.preview.bucket },
      { name = "CLOUDFRONT_DISTRIBUTION_ID", value = aws_cloudfront_distribution.live.id },
      { name = "NEXT_PUBLIC_BASE_URL", value = var.enable_tls ? "https://${local.fqdn}" : "http://${aws_lb.app.dns_name}" },
      # Base domain for per-site subdomains; the app builds "<slug>.${SITES_BASE_DOMAIN}"
      # as the CNAME target shown in the Domain Connect UI.
      { name = "SITES_BASE_DOMAIN", value = local.sites_domain },
    ]

    # Pull individual keys out of the Secrets Manager JSON document.
    secrets = [
      { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::" },
      { name = "SESSION_SECRET", valueFrom = "${aws_secretsmanager_secret.app.arn}:SESSION_SECRET::" },
      { name = "ANTHROPIC_API_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:ANTHROPIC_API_KEY::" },
      { name = "VOYAGE_API_KEY", valueFrom = "${aws_secretsmanager_secret.app.arn}:VOYAGE_API_KEY::" },
      { name = "SENTRY_DSN", valueFrom = "${aws_secretsmanager_secret.app.arn}:SENTRY_DSN::" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "admin"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -q -O /dev/null http://localhost:${var.app_port}/login || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 40
    }
  }])

  tags = { Name = "${local.name}-admin" }
}

resource "aws_ecs_service" "app" {
  name            = "${local.name}-admin"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.app_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "admin"
    container_port   = var.app_port
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  health_check_grace_period_seconds  = 60

  # CI updates the task definition; ignore image drift between applies.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  # Depend on whichever listener exists (HTTP-forward in smoke-test mode, HTTPS in TLS mode).
  depends_on = [aws_lb_listener.http_forward, aws_lb_listener.http_redirect, aws_lb_listener.https]
}

# ---- Autoscaling (CPU target tracking) ----
resource "aws_appautoscaling_target" "app" {
  max_capacity       = 6
  min_capacity       = var.app_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "app_cpu" {
  name               = "${local.name}-cpu-target"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.app.resource_id
  scalable_dimension = aws_appautoscaling_target.app.scalable_dimension
  service_namespace  = aws_appautoscaling_target.app.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification { predefined_metric_type = "ECSServiceAverageCPUUtilization" }
    target_value       = 65
    scale_in_cooldown  = 120
    scale_out_cooldown = 60
  }
}
