# Bootstrap — remote state + OIDC (one-time)

Run these once per AWS account, before the first `terraform apply`.

## 1. Terraform remote state (S3 + DynamoDB lock)

```bash
REGION=us-east-1
aws s3api create-bucket --bucket continue-leads-tfstate --region $REGION
aws s3api put-bucket-versioning --bucket continue-leads-tfstate \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket continue-leads-tfstate \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
aws dynamodb create-table --table-name continue-leads-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST --region $REGION
```

Then uncomment the `backend "s3"` block in `terraform/versions.tf` and run
`terraform init` (it will offer to migrate local state to S3).

## 2. GitHub OIDC deploy role (for CI, no long-lived keys)

Create an IAM role that trusts GitHub's OIDC provider, restricted to your repo, with
permissions to push to ECR, run/update ECS, register task definitions, read Terraform
outputs, and run one-off tasks. Put its ARN in the `AWS_DEPLOY_ROLE_ARN` repo secret.

Minimal trust policy (replace ORG/REPO):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:ref:refs/heads/main" }
    }
  }]
}
```

## 3. Environments

Use a separate `terraform.tfvars` (or workspace) per environment:
`environment = "staging"` and `environment = "prod"` produce independent, non-colliding
resource names (everything is prefixed `cl-<env>-`).
