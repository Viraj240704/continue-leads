# Public ALB terminating TLS for the admin app, with an ACM cert validated through
# Cloudflare DNS.

resource "aws_lb" "app" {
  name               = "${local.name}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
  tags               = { Name = "${local.name}-alb" }
}

resource "aws_lb_target_group" "app" {
  name        = "${local.name}-tg"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    path                = "/login"
    matcher             = "200-307" # /login is 200; some paths 307 — accept both
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
  tags = { Name = "${local.name}-tg" }
}

# ---- ACM certificate for admin.<domain>, DNS-validated via Cloudflare (TLS mode only) ----
resource "aws_acm_certificate" "admin" {
  count             = var.enable_tls ? 1 : 0
  domain_name       = local.fqdn
  validation_method = "DNS"
  lifecycle { create_before_destroy = true }
  tags = { Name = "${local.name}-admin-cert" }
}

# Single-domain cert → exactly one validation record. count (known at plan) avoids the
# for_each "unknown keys" problem while the cert doesn't exist yet.
resource "cloudflare_record" "admin_cert_validation" {
  count   = var.enable_tls ? 1 : 0
  zone_id = var.cloudflare_zone_id
  name    = tolist(aws_acm_certificate.admin[0].domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.admin[0].domain_validation_options)[0].resource_record_type
  content = trimsuffix(tolist(aws_acm_certificate.admin[0].domain_validation_options)[0].resource_record_value, ".")
  ttl     = 60
  proxied = false
}

resource "aws_acm_certificate_validation" "admin" {
  count                   = var.enable_tls ? 1 : 0
  certificate_arn         = aws_acm_certificate.admin[0].arn
  validation_record_fqdns = [for r in cloudflare_record.admin_cert_validation : r.hostname]
}

# ---- Listeners ----
# HTTP smoke-test mode (enable_tls = false): serve the app directly on :80 so it is
# reachable at http://<alb-dns-name> with no cert or custom domain.
resource "aws_lb_listener" "http_forward" {
  count             = var.enable_tls ? 0 : 1
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# TLS mode (enable_tls = true): redirect :80 -> :443.
resource "aws_lb_listener" "http_redirect" {
  count             = var.enable_tls ? 1 : 0
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count             = var.enable_tls ? 1 : 0
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.admin[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
