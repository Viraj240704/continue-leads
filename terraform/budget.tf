# ---------------------------------------------------------------------------
# Cost guardrails: $35 monthly budget, tiered alarms, and a best-effort HARD CAP.
#
# AWS has no native switch that stops billing at a dollar amount. The strongest
# real mechanism is AWS Budgets "Budget Actions": when actual spend hits 100% of
# the budget, Budgets automatically ATTACHES a deny policy to the developer role,
# blocking creation of new billable resources. Already-running resources are not
# force-stopped by AWS — the deny stops *new* spend. Alarms notify before that.
# ---------------------------------------------------------------------------

# The general alerts SNS topic (aws_sns_topic.alerts) is declared in cloudwatch.tf and
# shared by both the CloudWatch alarms and the AWS Budgets notifications below.

# Allow the AWS Budgets service to publish notifications to the alerts SNS topic.
data "aws_iam_policy_document" "budgets_sns_publish" {
  statement {
    sid     = "AllowBudgetsPublish"
    actions = ["SNS:Publish"]
    effect  = "Allow"
    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }
    resources = [aws_sns_topic.alerts.arn]
  }
}

resource "aws_sns_topic_policy" "alerts_budgets" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.budgets_sns_publish.json
}

# Email subscriptions so humans are notified (SNS topic alone is machine-only).
# One per address in var.alert_emails; each recipient must click the AWS confirmation email once.
resource "aws_sns_topic_subscription" "alerts_email" {
  for_each  = toset(var.alert_emails)
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

# ---- The $35 monthly cost budget with tiered notifications --------------------
resource "aws_budgets_budget" "monthly" {
  name         = "${local.name}-monthly-cap"
  budget_type  = "COST"
  limit_amount = tostring(var.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # 50% / 80% actual, plus a forecasted-100% early warning, plus 100% actual.
  dynamic "notification" {
    for_each = toset([50, 80, 100])
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
      subscriber_email_addresses = [] # emails arrive via the SNS topic subscriptions
    }
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_sns_topic_arns  = [aws_sns_topic.alerts.arn]
    subscriber_email_addresses = [] # emails arrive via the SNS topic subscriptions
  }

  tags = local.tags
}

# ---- Hard-cap enforcement: Budgets attaches a deny policy at 100% -------------
# Deny creation of the expensive resource types so a runaway can't blow past $35.
data "aws_iam_policy_document" "cost_deny" {
  statement {
    sid    = "DenyNewBillableResources"
    effect = "Deny"
    actions = [
      "ec2:RunInstances",
      "ec2:StartInstances",
      "ec2:CreateNatGateway",
      "rds:CreateDBInstance",
      "rds:CreateDBCluster",
      "rds:RestoreDBInstanceFromDBSnapshot",
      "rds:RestoreDBClusterFromSnapshot",
      "ecs:CreateService",
      "ecs:RunTask",
      "elasticloadbalancing:CreateLoadBalancer",
      "cloudfront:CreateDistribution",
      "elasticache:CreateCacheCluster",
      "elasticache:CreateReplicationGroup",
      "es:CreateElasticsearchDomain",
      "opensearch:CreateDomain",
      "redshift:CreateCluster",
      "sagemaker:CreateNotebookInstance",
      "sagemaker:CreateEndpoint",
      "emr:RunJobFlow",
      "eks:CreateCluster",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "cost_deny" {
  name        = "${local.name}-cost-deny"
  description = "Attached automatically by AWS Budgets at 100% of the monthly cap to block new billable resources."
  policy      = data.aws_iam_policy_document.cost_deny.json
  tags        = local.tags
}

# Execution role that AWS Budgets assumes to attach/detach the deny policy.
data "aws_iam_policy_document" "budgets_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "budget_action" {
  count              = var.budget_enforce ? 1 : 0
  name               = "${local.name}-budget-action"
  assume_role_policy = data.aws_iam_policy_document.budgets_assume.json
  tags               = local.tags
}

data "aws_iam_policy_document" "budget_action_perms" {
  statement {
    sid       = "ManageDenyPolicyOnDeveloper"
    effect    = "Allow"
    actions   = ["iam:AttachRolePolicy", "iam:DetachRolePolicy"]
    resources = [aws_iam_role.developer.arn]
    condition {
      test     = "ArnEquals"
      variable = "iam:PolicyARN"
      values   = [aws_iam_policy.cost_deny.arn]
    }
  }
}

resource "aws_iam_role_policy" "budget_action" {
  count  = var.budget_enforce ? 1 : 0
  name   = "attach-cost-deny"
  role   = aws_iam_role.budget_action[0].id
  policy = data.aws_iam_policy_document.budget_action_perms.json
}

resource "aws_budgets_budget_action" "hard_cap" {
  count              = var.budget_enforce ? 1 : 0
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "APPLY_IAM_POLICY"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budget_action[0].arn

  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = 100
  }

  definition {
    iam_action_definition {
      policy_arn = aws_iam_policy.cost_deny.arn
      roles      = [aws_iam_role.developer.name]
    }
  }

  # Notify via SNS; the email recipients are subscribed to the topic (see alerts_email).
  subscriber {
    address           = aws_sns_topic.alerts.arn
    subscription_type = "SNS"
  }
}

# ---- Billing CloudWatch alarm (billing metrics live only in us-east-1) --------
resource "aws_sns_topic" "billing_alerts" {
  provider = aws.us_east_1
  name     = "${local.name}-billing-alerts"
  tags     = local.tags
}

resource "aws_sns_topic_subscription" "billing_email" {
  for_each  = toset(var.alert_emails)
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.billing_alerts.arn
  protocol  = "email"
  endpoint  = each.value
}

resource "aws_cloudwatch_metric_alarm" "billing" {
  provider            = aws.us_east_1
  alarm_name          = "${local.name}-estimated-charges-over-${var.monthly_budget_usd}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "EstimatedCharges"
  namespace           = "AWS/Billing"
  period              = 21600 # 6h — billing metric updates a few times per day
  statistic           = "Maximum"
  threshold           = var.monthly_budget_usd
  alarm_description   = "Estimated month-to-date charges exceeded $${var.monthly_budget_usd}."
  dimensions          = { Currency = "USD" }
  alarm_actions       = [aws_sns_topic.billing_alerts.arn]
  ok_actions          = [aws_sns_topic.billing_alerts.arn]
  tags                = local.tags
}
