# Handy endpoints surfaced after apply.

output "admin_url" {
  description = "Reachable admin app URL (HTTP at the ALB DNS name until enable_tls = true)."
  value       = var.enable_tls ? "https://${local.fqdn}" : "http://${aws_lb.app.dns_name}"
}

output "alb_dns_name" {
  description = "ALB's AWS-assigned DNS name."
  value       = aws_lb.app.dns_name
}

output "cloudfront_domain" {
  description = "CloudFront domain for live sites."
  value       = aws_cloudfront_distribution.live.domain_name
}

# ---- Consumed by scripts/run-migrations.sh (one-off migration task) ----
output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "private_subnet_ids" {
  description = "For running one-off migration tasks."
  value       = aws_subnet.private[*].id
}

output "app_security_group_id" {
  value = aws_security_group.app.id
}

output "app_secret_arn" {
  value = aws_secretsmanager_secret.app.arn
}
