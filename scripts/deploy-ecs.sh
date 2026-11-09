#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: ECS_CLUSTER=<cluster> ECS_SERVICE=<service> $0 <new-task-definition-arn>"
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

for command in aws jq date sleep; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "ERROR: Required command not found: $command" >&2
    exit 1
  }
done

: "${ECS_CLUSTER:?Set ECS_CLUSTER}"
: "${ECS_SERVICE:?Set ECS_SERVICE}"

NEW_TASK_DEFINITION="$1"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ap-south-1}}"

DEPLOYMENT_TIMEOUT_SECONDS="${DEPLOYMENT_TIMEOUT_SECONDS:-300}"
ROLLBACK_TIMEOUT_SECONDS="${ROLLBACK_TIMEOUT_SECONDS:-300}"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-10}"

for value in "$DEPLOYMENT_TIMEOUT_SECONDS" \
             "$ROLLBACK_TIMEOUT_SECONDS" \
             "$POLL_INTERVAL_SECONDS"; do
  [[ "$value" =~ ^[1-9][0-9]*$ ]] || {
    echo "ERROR: Timeout and polling values must be positive integers." >&2
    exit 1
  }
done

echo "=================================================="
echo " ECS DEPLOYMENT WITH AUTOMATIC ROLLBACK"
echo "=================================================="
echo "Cluster: $ECS_CLUSTER"
echo "Service: $ECS_SERVICE"
echo "Region:  $AWS_REGION"
echo "New task definition: $NEW_TASK_DEFINITION"

read_service_snapshot() {
  local response
  local primary

  response="$(aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --region "$AWS_REGION" \
    --output json)"

  jq -e '.services | length == 1' \
    <<< "$response" >/dev/null || return 1

  SERVICE_STATUS="$(jq -r '.services[0].status // empty' <<< "$response")"
  SERVICE_TASK_DEFINITION="$(jq -r '.services[0].taskDefinition // empty' <<< "$response")"
  SERVICE_DESIRED_COUNT="$(jq -r '.services[0].desiredCount // 0' <<< "$response")"
  SERVICE_RUNNING_COUNT="$(jq -r '.services[0].runningCount // 0' <<< "$response")"
  SERVICE_PENDING_COUNT="$(jq -r '.services[0].pendingCount // 0' <<< "$response")"

  primary="$(jq -c \
    '[.services[0].deployments[]? | select(.status == "PRIMARY")][0] // {}' \
    <<< "$response")"

  PRIMARY_TASK_DEFINITION="$(jq -r '.taskDefinition // empty' <<< "$primary")"
  PRIMARY_ROLLOUT_STATE="$(jq -r '.rolloutState // empty' <<< "$primary")"

  TARGET_GROUP_ARN="$(jq -r \
    '.services[0].loadBalancers[0].targetGroupArn // empty' \
    <<< "$response")"

  [[ -n "$TARGET_GROUP_ARN" ]]
}

get_healthy_target_count() {
  local response

  response="$(aws elbv2 describe-target-health \
    --target-group-arn "$TARGET_GROUP_ARN" \
    --region "$AWS_REGION" \
    --output json)"

  jq -r \
    '[.TargetHealthDescriptions[]? | select(.TargetHealth.State == "healthy")] | length' \
    <<< "$response"
}

# Capture the last known-good task definition.
read_service_snapshot || {
  echo "ERROR: Could not inspect the ECS service." >&2
  exit 1
}

PREVIOUS_TASK_DEFINITION="$SERVICE_TASK_DEFINITION"

if [[ "$SERVICE_STATUS" != "ACTIVE" ]]; then
  echo "ERROR: ECS service is not ACTIVE." >&2
  exit 1
fi

if [[ "$PREVIOUS_TASK_DEFINITION" == "$NEW_TASK_DEFINITION" ]]; then
  echo "ERROR: New task definition is already deployed."
  exit 1
fi

if [[ "$PRIMARY_TASK_DEFINITION" != "$PREVIOUS_TASK_DEFINITION" ||
      "$PRIMARY_ROLLOUT_STATE" != "COMPLETED" ||
      "$SERVICE_PENDING_COUNT" -ne 0 ||
      "$SERVICE_RUNNING_COUNT" -lt "$SERVICE_DESIRED_COUNT" ]]; then
  echo "ERROR: Existing ECS service is not stable." >&2
  exit 1
fi

if ! PREVIOUS_HEALTHY_TARGETS="$(get_healthy_target_count)"; then
  echo "ERROR: Could not inspect ALB target health." >&2
  exit 1
fi

if (( PREVIOUS_HEALTHY_TARGETS < SERVICE_DESIRED_COUNT )); then
  echo "ERROR: Existing deployment does not have enough healthy targets." >&2
  exit 1
fi

NEW_TASK_STATUS="$(aws ecs describe-task-definition \
  --task-definition "$NEW_TASK_DEFINITION" \
  --region "$AWS_REGION" \
  --query 'taskDefinition.status' \
  --output text)"

if [[ "$NEW_TASK_STATUS" != "ACTIVE" ]]; then
  echo "ERROR: New task definition is not ACTIVE." >&2
  exit 1
fi

echo ""
echo "Previous working task definition:"
echo "$PREVIOUS_TASK_DEFINITION"

echo ""
echo "Previous deployment is healthy."
echo "Starting new deployment..."

aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$NEW_TASK_DEFINITION" \
  --region "$AWS_REGION" \
  --output json >/dev/null

DEPLOYMENT_DEADLINE=$(( $(date +%s) + DEPLOYMENT_TIMEOUT_SECONDS ))
DEPLOYMENT_FAILURE_REASON=""

echo ""
echo "Monitoring deployment for up to ${DEPLOYMENT_TIMEOUT_SECONDS} seconds..."

while (( $(date +%s) < DEPLOYMENT_DEADLINE )); do

  if ! read_service_snapshot; then
    echo "WARNING: Could not read service status; retrying..."
    sleep "$POLL_INTERVAL_SECONDS"
    continue
  fi

  if [[ "$PRIMARY_ROLLOUT_STATE" == "FAILED" ]]; then
    DEPLOYMENT_FAILURE_REASON="ECS deployment circuit breaker reported FAILED."
    break
  fi

  if [[ "$SERVICE_TASK_DEFINITION" == "$PREVIOUS_TASK_DEFINITION" &&
        "$PRIMARY_TASK_DEFINITION" == "$PREVIOUS_TASK_DEFINITION" &&
        "$PRIMARY_ROLLOUT_STATE" == "COMPLETED" ]]; then
    DEPLOYMENT_FAILURE_REASON="ECS automatically rolled back the failed deployment."
    break
  fi

  if [[ "$SERVICE_STATUS" == "ACTIVE" &&
        "$SERVICE_TASK_DEFINITION" == "$NEW_TASK_DEFINITION" &&
        "$PRIMARY_TASK_DEFINITION" == "$NEW_TASK_DEFINITION" &&
        "$PRIMARY_ROLLOUT_STATE" == "COMPLETED" &&
        "$SERVICE_PENDING_COUNT" -eq 0 &&
        "$SERVICE_RUNNING_COUNT" -ge "$SERVICE_DESIRED_COUNT" ]]; then

    if HEALTHY_TARGETS="$(get_healthy_target_count 2>/dev/null)" &&
       (( HEALTHY_TARGETS >= SERVICE_DESIRED_COUNT )); then
      echo ""
      echo "SUCCESS: New deployment is stable and healthy."
      echo "Task definition: $NEW_TASK_DEFINITION"
      echo "Healthy ALB targets: $HEALTHY_TARGETS"
      exit 0
    fi
  fi

  echo "Deployment: $PRIMARY_ROLLOUT_STATE | Running: $SERVICE_RUNNING_COUNT/$SERVICE_DESIRED_COUNT | Pending: $SERVICE_PENDING_COUNT"

  sleep "$POLL_INTERVAL_SECONDS"
done

if [[ -z "$DEPLOYMENT_FAILURE_REASON" ]]; then
  DEPLOYMENT_FAILURE_REASON="Deployment did not become healthy within the five-minute window."
fi

echo ""
echo "DEPLOYMENT FAILED: $DEPLOYMENT_FAILURE_REASON"
echo "Restoring previous task definition..."

# ECS may already have started its circuit-breaker rollback.
# Avoid starting a duplicate rollback when the previous revision is primary.
if ! read_service_snapshot; then
  echo "ERROR: Unable to inspect service before rollback." >&2
  exit 1
fi

if [[ "$PRIMARY_TASK_DEFINITION" != "$PREVIOUS_TASK_DEFINITION" ]]; then
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$ECS_SERVICE" \
    --task-definition "$PREVIOUS_TASK_DEFINITION" \
    --region "$AWS_REGION" \
    --output json >/dev/null

  echo "Rollback to previous task definition requested."
else
  echo "ECS has already selected the previous task definition for rollback."
fi

echo ""
echo "Verifying recovery of the previous deployment..."

ROLLBACK_DEADLINE=$(( $(date +%s) + ROLLBACK_TIMEOUT_SECONDS ))

while (( $(date +%s) < ROLLBACK_DEADLINE )); do

  if ! read_service_snapshot; then
    echo "WARNING: Could not read service status; retrying..."
    sleep "$POLL_INTERVAL_SECONDS"
    continue
  fi

  if [[ "$SERVICE_TASK_DEFINITION" == "$PREVIOUS_TASK_DEFINITION" &&
        "$PRIMARY_TASK_DEFINITION" == "$PREVIOUS_TASK_DEFINITION" &&
        "$PRIMARY_ROLLOUT_STATE" == "COMPLETED" &&
        "$SERVICE_PENDING_COUNT" -eq 0 &&
        "$SERVICE_RUNNING_COUNT" -ge "$SERVICE_DESIRED_COUNT" ]]; then

    if HEALTHY_TARGETS="$(get_healthy_target_count 2>/dev/null)" &&
       (( HEALTHY_TARGETS >= SERVICE_DESIRED_COUNT )); then
      echo ""
      echo "ROLLBACK SUCCESSFUL."
      echo "Restored task definition: $PREVIOUS_TASK_DEFINITION"
      echo "Healthy ALB targets: $HEALTHY_TARGETS"
      echo "The deployment will be marked as FAILED."
      exit 1
    fi
  fi

  echo "Rollback: $PRIMARY_ROLLOUT_STATE | Running: $SERVICE_RUNNING_COUNT/$SERVICE_DESIRED_COUNT | Pending: $SERVICE_PENDING_COUNT"

  sleep "$POLL_INTERVAL_SECONDS"
done

echo "CRITICAL: Previous task definition was restored or requested,"
echo "but service recovery was not verified within the rollback timeout." >&2
exit 1
