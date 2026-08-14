# Staging Deploy Runbook

How to bring the Continue Leads **staging** environment up from scratch to a working
admin app backed by RDS, and how to tear it back down. AWS account **519725697847**,
region **us-east-1**.

> **Monorepo layout.** App and infra live in one repo: `apps/` + `packages/` (the pnpm
> app) alongside `terraform/`, `docker/`, and `scripts/`. Docker builds run from the repo
> root as the build context; the root `.dockerignore` keeps `terraform/`, state, and
> secrets out of the image.

---

## 0. Layers

- **Foundation** (always on): VPC/subnets/NAT, RDS PostgreSQL 16 + pgvector, KMS, Secrets
  Manager, S3 buckets, ECR repo, IAM. Provisioned by the base `.tf` files.
- **Deploy layer** (created/destroyed per environment): ALB, ECS Fargate cluster/service/
  task-def, CloudFront, WAF, autoscaling, CloudWatch logs. This is what you apply/destroy.

## 1. The `enable_tls` toggle

The DNS + TLS layer is gated behind `var.enable_tls` (in `terraform.tfvars`):

- `enable_tls = false` → **HTTP smoke test.** App is served over plain HTTP at the ALB's
  AWS DNS name. No Cloudflare, no ACM certs. CloudFront uses its default `*.cloudfront.net`
  cert. `COOKIE_SECURE=false` so sessions work over HTTP.
- `enable_tls = true` → **Full TLS.** ACM certs for `admin.<root>` and `*.sites.<root>`,
  DNS-validated via Cloudflare; HTTPS listener; `COOKIE_SECURE=true`. Requires a real
  `cloudflare_api_token` (40-char) and `cloudflare_zone_id`.

## 2. Prerequisites

- AWS profile `continue-leads` → account 519725697847 (`aws sts get-caller-identity`).
- Terraform ≥ 1.6, Docker (with buildx), and the app repo checked out as build context.
- `export AWS_PROFILE=continue-leads`

## 3. Configuration (`terraform/terraform.tfvars`)

| Key | Notes |
|---|---|
| `enable_tls` | `false` for HTTP smoke test; `true` for real domain + TLS |
| `app_image` | ECR image URI the ECS task runs (e.g. `…/cl-staging-admin:app`) |
| `session_secret`, `anthropic_api_key`, `voyage_api_key`, `sentry_dsn` | app secrets → Secrets Manager |
| `cloudflare_api_token`, `cloudflare_zone_id` | **only** needed when `enable_tls = true` |

`DATABASE_URL` is **not** set by hand — Terraform builds it in `secrets.tf` from the RDS
endpoint + generated password, with `?sslmode=no-verify` (RDS enforces SSL).

## 4. Build & push images

Run from the **repo root** (the build context). Fargate needs a single-arch `linux/amd64`
image with no attestation manifest, hence `--provenance=false`.

```bash
ECR=519725697847.dkr.ecr.us-east-1.amazonaws.com/cl-staging-admin
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 519725697847.dkr.ecr.us-east-1.amazonaws.com

# App image (Next.js standalone)
docker buildx build --provenance=false --platform linux/amd64 \
  -f docker/Dockerfile -t $ECR:app --push .

# Migration image (packages/db + pg/dotenv) — separate because the app standalone bundle
# does not include the migration tool.
docker buildx build --provenance=false --platform linux/amd64 \
  -f docker/Dockerfile.migrate -t $ECR:migrate --push .
```

Set `app_image = "…/cl-staging-admin:app"` in `terraform.tfvars`.

## 5. Apply infra

```bash
cd terraform
terraform apply        # ~15-20 min (CloudFront is the slow part)
```

Outputs: `admin_url`, `alb_dns_name`, `cloudfront_domain`, plus `ecs_cluster_name`,
`private_subnet_ids`, `app_security_group_id`, `app_secret_arn` (used by the migration script).

## 6. Migrate + seed the database

The one-off tasks log to `/ecs/cl-migrate`. The least-privilege execution role **cannot
create** that log group, so create it once up front:

```bash
aws logs create-log-group --log-group-name /ecs/cl-migrate --region us-east-1

# Migrations (0001-0007)
bash scripts/run-migrations.sh 519725697847.dkr.ecr.us-east-1.amazonaws.com/cl-staging-admin:migrate
```

Seed (first admin user + demo packs) — same pattern, command `node seed.mjs` on the
`:migrate` image. Creates `admin@continueleads.test` / `reviewer@continueleads.test`
(password `ChangeMe!123`).

## 7. Verify

```bash
curl -o /dev/null -w "%{http_code}\n" "$(terraform -chdir=terraform output -raw admin_url)/login"   # 200
```

Then log in at `admin_url` with the seeded credentials → the dashboard renders from RDS.

> If ECS just deployed a new task-def revision, the service has `ignore_changes=[task_definition]`
> (CI/manual drives deploys). Point it at the revision explicitly:
> `aws ecs update-service --cluster cl-staging-cluster --service cl-staging-admin --task-definition cl-staging-admin:<N> --force-new-deployment`

## 8. Enable TLS / custom domain (later)

1. Put a real `cloudflare_api_token` (Zone.DNS edit for `continueleads.com`) and
   `cloudflare_zone_id` in `terraform.tfvars`.
2. `enable_tls = true`, then `terraform apply`.
3. App is served at `https://admin.continueleads.com`; live sites at `*.sites.continueleads.com`.

## 9. Tear down the deploy layer (keep foundation)

A plain `terraform destroy` would remove the foundation too. Destroy **only** the deploy
layer with targets:

```bash
cd terraform
terraform destroy -auto-approve \
  -target=aws_appautoscaling_policy.app_cpu -target=aws_appautoscaling_target.app \
  -target=aws_ecs_service.app -target=aws_ecs_task_definition.app -target=aws_ecs_cluster.main \
  -target=aws_lb_listener.http_forward -target=aws_lb_listener.http_redirect -target=aws_lb_listener.https \
  -target=aws_lb_target_group.app -target=aws_lb.app \
  -target=aws_s3_bucket_policy.live -target=aws_cloudfront_distribution.live \
  -target=aws_cloudfront_origin_access_control.live -target=aws_wafv2_web_acl.cloudfront \
  -target=aws_cloudwatch_log_group.app
```

RDS, S3, Secrets, KMS, VPC, NAT, ECR stay. Migrated/seeded data persists in RDS.

## 10. Gotchas discovered (don't relearn these)

- **RDS requires SSL.** Non-SSL connections get `no pg_hba.conf entry … no encryption`.
  Fixed via `?sslmode=no-verify` on `DATABASE_URL` in `secrets.tf`. (For prod, switch to
  `verify-full` with the RDS CA bundle.)
- **Next.js standalone binds to `$HOSTNAME`.** ECS sets `HOSTNAME` to the container
  hostname, so the app doesn't listen on `localhost` and the container health check
  (`wget localhost:3000/login`) fails while the ALB check passes. Fixed with
  `HOSTNAME=0.0.0.0` env in `ecs.tf`.
- **Migration tool isn't in the app image.** The Next standalone bundle only traces what
  the app imports; `packages/db` + `dotenv` are excluded. Use the separate `:migrate` image.
- **Fargate + buildx manifests.** Default buildx output is a multi-arch manifest with
  attestations that Fargate can reject. Build with `--provenance=false --platform linux/amd64`.
- **`/ecs/cl-migrate` log group** must pre-exist (exec role lacks `logs:CreateLogGroup`).
  TODO: manage it in Terraform, or grant the permission.
- **Windows/Git Bash:** disable path mangling for log-group/stream args
  (`MSYS_NO_PATHCONV=1`); force UTF-8 for the AWS CLI when reading logs with unicode
  (`PYTHONUTF8=1`).

## 11. Reference

- ECR repo: `519725697847.dkr.ecr.us-east-1.amazonaws.com/cl-staging-admin`
- ECS cluster / service: `cl-staging-cluster` / `cl-staging-admin`
- Migration log group: `/ecs/cl-migrate`; app log group: `/ecs/cl-staging-admin`
