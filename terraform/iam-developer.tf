# ---------------------------------------------------------------------------
# Developer role — an assumable IAM role with "nearly all" permissions this
# project needs (VPC/ECS/ECR/RDS/S3/CloudFront/WAF/ACM/KMS/Secrets/Logs/…),
# scoped so it is NOT an account admin:
#   * PowerUserAccess  -> everything except IAM/Organizations/Account.
#   * project IAM      -> manage only IAM roles/policies named "cl-*" (+ PassRole),
#                         so Terraform for THIS project works without full IAM admin.
#   * guardrail deny   -> block org/account/billing-config changes outright.
# Tagged for cost allocation and ownership.
# ---------------------------------------------------------------------------

locals {
  # Who may assume the role. Default: the account root (any IAM user granted assume).
  developer_trust = length(var.developer_trust_arns) > 0 ? var.developer_trust_arns : ["arn:aws:iam::${local.account}:root"]

  developer_tags = merge(local.tags, {
    Role      = "developer"
    ManagedBy = "terraform"
    Purpose   = "continue-leads-phase1"
  })
}

data "aws_iam_policy_document" "developer_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    effect  = "Allow"
    principals {
      type        = "AWS"
      identifiers = local.developer_trust
    }
    # Require MFA to assume — drop this block if you assume via CI/OIDC.
    condition {
      test     = "Bool"
      variable = "aws:MultiFactorAuthPresent"
      values   = ["true"]
    }
  }
}

resource "aws_iam_role" "developer" {
  name                 = "${local.name}-developer"
  description          = "Developer role for the Continue Leads project (scoped-broad, not account admin)."
  assume_role_policy   = data.aws_iam_policy_document.developer_assume.json
  max_session_duration = 3600 * 4
  tags                 = local.developer_tags
}

# Everything except IAM / Organizations / Account.
resource "aws_iam_role_policy_attachment" "developer_poweruser" {
  role       = aws_iam_role.developer.name
  policy_arn = "arn:aws:iam::aws:policy/PowerUserAccess"
}

# Project-scoped IAM management so Terraform can create/patch this project's roles.
data "aws_iam_policy_document" "developer_iam" {
  statement {
    sid    = "ManageProjectIamRoles"
    effect = "Allow"
    actions = [
      "iam:CreateRole", "iam:DeleteRole", "iam:GetRole", "iam:ListRoles",
      "iam:UpdateRole", "iam:UpdateAssumeRolePolicy",
      "iam:AttachRolePolicy", "iam:DetachRolePolicy", "iam:ListAttachedRolePolicies",
      "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:GetRolePolicy", "iam:ListRolePolicies",
      "iam:CreatePolicy", "iam:DeletePolicy", "iam:GetPolicy", "iam:ListPolicyVersions",
      "iam:CreatePolicyVersion", "iam:DeletePolicyVersion", "iam:GetPolicyVersion",
      "iam:TagRole", "iam:UntagRole", "iam:TagPolicy", "iam:UntagPolicy",
      "iam:CreateServiceLinkedRole",
      "iam:CreateInstanceProfile", "iam:DeleteInstanceProfile",
      "iam:AddRoleToInstanceProfile", "iam:RemoveRoleFromInstanceProfile", "iam:GetInstanceProfile",
    ]
    resources = [
      "arn:aws:iam::${local.account}:role/${var.name_prefix}-*",
      "arn:aws:iam::${local.account}:policy/${var.name_prefix}-*",
      "arn:aws:iam::${local.account}:instance-profile/${var.name_prefix}-*",
    ]
  }

  statement {
    sid       = "PassProjectRoles"
    effect    = "Allow"
    actions   = ["iam:PassRole"]
    resources = ["arn:aws:iam::${local.account}:role/${var.name_prefix}-*"]
  }

  # Read-only IAM + STS + budgets so plans/console work.
  statement {
    sid    = "IamReadAndBudgetsRead"
    effect = "Allow"
    actions = [
      "iam:List*", "iam:Get*", "iam:GenerateServiceLastAccessedDetails",
      "sts:GetCallerIdentity",
      "budgets:ViewBudget", "budgets:DescribeBudgetActionsForBudget",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "developer_iam" {
  name        = "${local.name}-developer-iam"
  description = "Project-scoped IAM management for the developer role."
  policy      = data.aws_iam_policy_document.developer_iam.json
  tags        = local.developer_tags
}

resource "aws_iam_role_policy_attachment" "developer_iam" {
  role       = aws_iam_role.developer.name
  policy_arn = aws_iam_policy.developer_iam.arn
}

# Hard guardrails — deny account/org/billing-config changes even though PowerUser
# would otherwise not grant them (defense in depth if policies drift).
data "aws_iam_policy_document" "developer_guardrail" {
  statement {
    sid    = "DenyDangerousAccountActions"
    effect = "Deny"
    actions = [
      "organizations:*",
      "account:*",
      "aws-portal:ModifyBilling",
      "aws-portal:ModifyAccount",
      "iam:CreateUser", "iam:CreateAccessKey", "iam:DeleteAccountPasswordPolicy",
      "iam:*LoginProfile",
      "kms:ScheduleKeyDeletion", "kms:DisableKey",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "developer_guardrail" {
  name        = "${local.name}-developer-guardrail"
  description = "Explicit denies for account/org/billing/root-credential actions."
  policy      = data.aws_iam_policy_document.developer_guardrail.json
  tags        = local.developer_tags
}

resource "aws_iam_role_policy_attachment" "developer_guardrail" {
  role       = aws_iam_role.developer.name
  policy_arn = aws_iam_policy.developer_guardrail.arn
}

output "developer_role_arn" {
  description = "Assume this to work on the project: aws sts assume-role --role-arn <arn> --role-session-name dev"
  value       = aws_iam_role.developer.arn
}
