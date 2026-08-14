#!/usr/bin/env bash
# Run DB migrations as a one-off ECS Fargate task using the freshly-pushed image.
# The image already contains packages/db; we override the command to run the migrator.
# Usage: run-migrations.sh <image-uri>
set -euo pipefail

IMAGE="${1:?usage: run-migrations.sh <image-uri>}"
CLUSTER="$(terraform -chdir=terraform output -raw ecs_cluster_name)"
SUBNETS="$(terraform -chdir=terraform output -json private_subnet_ids | tr -d '[]" ' )"
SG="$(terraform -chdir=terraform output -raw app_security_group_id)"
SECRET_ARN="$(terraform -chdir=terraform output -raw app_secret_arn)"
REGION="${AWS_REGION:-us-east-1}"
EXEC_ROLE="$(aws iam list-roles --query "Roles[?contains(RoleName,'ecs-exec')].Arn | [0]" --output text)"

echo "Registering one-off migration task definition…"
TASK_DEF_ARN=$(aws ecs register-task-definition \
  --family cl-migrate \
  --requires-compatibilities FARGATE --network-mode awsvpc \
  --cpu 256 --memory 512 \
  --execution-role-arn "$EXEC_ROLE" \
  --container-definitions "$(cat <<JSON
[{
  "name":"migrate","image":"${IMAGE}","essential":true,
  "command":["node","migrate.mjs"],
  "secrets":[{"name":"DATABASE_URL","valueFrom":"${SECRET_ARN}:DATABASE_URL::"}],
  "logConfiguration":{"logDriver":"awslogs","options":{
    "awslogs-group":"/ecs/cl-migrate","awslogs-region":"${REGION}","awslogs-stream-prefix":"migrate"}}
}]
JSON
)" --query 'taskDefinition.taskDefinitionArn' --output text)

echo "Running migration task…"
TASK_ARN=$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE \
  --task-definition "$TASK_DEF_ARN" \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${SG}],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' --output text)

echo "Waiting for migration to finish ($TASK_ARN)…"
aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN"
CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
  --query 'tasks[0].containers[0].exitCode' --output text)
echo "Migration exit code: $CODE"
[ "$CODE" = "0" ] || { echo "Migration FAILED"; exit 1; }
