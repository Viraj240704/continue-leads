# GitHub Actions OIDC: lets the staging deploy workflow assume a scoped role via
# short-lived tokens (no long-lived AWS keys in GitHub secrets). The role can push
# to ECR and drive an ECS deploy + one-off migration task — nothing else.

# ---- OIDC identity provider for GitHub Actions ----
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  # GitHub's OIDC root CA thumbprint. AWS no longer verifies this for the GitHub
  # provider, but the argument is still required by the API.
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
  tags            = { Name = "${local.name}-github-oidc" }
}

# ---- Trust policy: only this repo, only the allowed refs ----
data "aws_iam_policy_document" "github_ci_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # This org customizes the OIDC subject claim to append the immutable org/repo
    # IDs (e.g. `Continue-Leads@313512775/continue-leads@1324290365`). Accept both
    # that ID-qualified form and the plain default, so the policy keeps working if
    # the org toggles the setting. Owner/repo names are still pinned; only the ref
    # set is configurable.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = flatten([for ref in var.github_deploy_refs : [
        "repo:${var.github_repo}:ref:${ref}",
        "repo:${split("/", var.github_repo)[0]}@*/${split("/", var.github_repo)[1]}@*:ref:${ref}",
      ]])
    }
  }
}

resource "aws_iam_role" "github_ci" {
  name               = "${local.name}-github-ci"
  assume_role_policy = data.aws_iam_policy_document.github_ci_assume.json
  tags               = { Name = "${local.name}-github-ci" }
}

# ---- Permissions: ECR push + ECS deploy + one-off migration task ----
data "aws_iam_policy_document" "github_ci" {
  # Obtain an ECR auth token (not resource-scopable).
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  # Push/pull layers to the app repo only.
  statement {
    sid = "EcrPushPull"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
      "ecr:PutImage",
    ]
    resources = [aws_ecr_repository.app.arn]
  }

  # Read task defs, register new revisions, roll the service, and run one-off tasks.
  statement {
    sid = "EcsDeploy"
    actions = [
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:DescribeTasks",
      "ecs:ListTasks",
      "ecs:RegisterTaskDefinition",
      "ecs:UpdateService",
      "ecs:RunTask",
    ]
    resources = ["*"] # ECS deploy actions are largely not resource-scopable
  }

  # Hand the ECS roles to the task definitions we register/run.
  statement {
    sid       = "PassEcsRoles"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }

  # Ensure the migration log group exists (exec role lacks CreateLogGroup) and read
  # deploy/migration logs.
  statement {
    sid = "MigrateLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:DescribeLogGroups",
      "logs:DescribeLogStreams",
      "logs:GetLogEvents",
    ]
    resources = ["*"]
  }

  # Discover the resources the deploy needs to look up at runtime: the private
  # subnets / app SG / app secret for the migration task, the ECS execution role
  # (looked up by name), and the ALB DNS name for the smoke test. These are all
  # List/Describe reads and are not resource-scopable.
  statement {
    sid = "DiscoverResources"
    actions = [
      "ec2:DescribeSubnets",
      "ec2:DescribeSecurityGroups",
      "secretsmanager:DescribeSecret",
      "iam:ListRoles",
      "elasticloadbalancing:DescribeLoadBalancers",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_ci" {
  name   = "${local.name}-github-ci"
  role   = aws_iam_role.github_ci.id
  policy = data.aws_iam_policy_document.github_ci.json
}

output "github_ci_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN GitHub secret for the staging workflow."
  value       = aws_iam_role.github_ci.arn
}
