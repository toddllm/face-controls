#!/usr/bin/env bash
# Deploy static web files to S3 bucket
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
cd "$PROJECT_ROOT"
# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
# Deploy static web files to S3 website bucket matching your DOMAIN
## Static website hosting bucket must match domain name
HOST_BUCKET="facecontrolgame-static"
echo "Ensuring S3 bucket s3://$HOST_BUCKET exists..." >&2
if ! aws s3api head-bucket --bucket "$HOST_BUCKET" >/dev/null 2>&1; then
  echo "Bucket s3://$HOST_BUCKET not found. Creating..." >&2
  aws s3api create-bucket --bucket "$HOST_BUCKET" --region "${AWS_REGION:-us-east-1}" \
    $( [ "${AWS_REGION:-us-east-1}" != "us-east-1" ] && echo "--create-bucket-configuration LocationConstraint=${AWS_REGION}" )
fi
echo "Syncing local web/ folder to s3://$HOST_BUCKET" >&2
aws s3 sync web/ "s3://$HOST_BUCKET" --delete
echo "Configuring website hosting on $HOST_BUCKET" >&2
aws s3 website "s3://$HOST_BUCKET" --index-document index.html --error-document index.html
ENDPOINT="$HOST_BUCKET.s3-website-${AWS_REGION:-us-east-1}.amazonaws.com"
echo "Static files deployed. Website endpoint: http://$ENDPOINT" >&2

# Optionally invalidate CloudFront distribution if provided
if [ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "Invalidating CloudFront distribution ${CLOUDFRONT_DISTRIBUTION_ID}" >&2
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*" >/dev/null 2>&1
  # When using CloudFront, don't update Route53 to point to S3
  echo "CloudFront distribution ID provided - skipping Route53 update to preserve CloudFront configuration" >&2
else
  # Only update Route53 to point to S3 directly if no CloudFront distribution ID is provided
  # Update Route53 record for custom domain if specified
  if [ -n "${DOMAIN:-}" ]; then
    # Extract hostname from DOMAIN (remove protocol and trailing slash)
    HOST=$(echo "$DOMAIN" | sed -E 's~https?://~~' | sed 's~/$~~')
    echo "Updating Route53 record for $HOST" >&2
    # Determine hosted zone ID: allow override via HOSTED_ZONE_ID env
    if [ -n "${HOSTED_ZONE_ID:-}" ]; then
      ZONE_ID="$HOSTED_ZONE_ID"
    else
      # Use the public hosted zone (PrivateZone==false)
      ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$HOST" \
        --query 'HostedZones[?Config.PrivateZone==`false`].Id | [0]' --output text | sed 's#/hostedzone/##')
    fi
    if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "None" ]; then
      echo "Warning: Hosted zone for $HOST not found; skipping Route53 update" >&2
    else
      # Map AWS region to S3 website endpoint HostedZoneId
      case "${AWS_REGION:-us-east-1}" in
        us-east-1) S3_ZONE_ID="Z3AQBSTGFYJSTF" ;;  # US East (N. Virginia)
        us-east-2) S3_ZONE_ID="Z2O1EMRO9K5GLX" ;;  # US East (Ohio)
        us-west-1) S3_ZONE_ID="Z2F56UZL2M1ACD" ;;  # US West (N. California)
        us-west-2) S3_ZONE_ID="Z3BJ6K6RIION7M" ;;  # US West (Oregon)
        *) S3_ZONE_ID="" ;;
      esac
      if [ -n "$S3_ZONE_ID" ]; then
        ENDPOINT="$HOST_BUCKET.s3-website-${AWS_REGION:-us-east-1}.amazonaws.com"
        echo "Upserting alias A record $HOST -> $ENDPOINT (zone $ZONE_ID)" >&2
        CHANGE_ID=$(aws route53 change-resource-record-sets \
          --hosted-zone-id "$ZONE_ID" \
          --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$HOST\",\"Type\":\"A\",\"AliasTarget\":{\"HostedZoneId\":\"$S3_ZONE_ID\",\"DNSName\":\"$ENDPOINT\",\"EvaluateTargetHealth\":false}}}]}" \
          --query ChangeInfo.Id --output text)
        echo "Waiting for Route53 change $CHANGE_ID to INSYNC..." >&2
        aws route53 wait resource-record-sets-changed --id "$CHANGE_ID"
      else
        echo "Region ${AWS_REGION:-us-east-1} not supported for S3 website alias; skipping" >&2
      fi
    fi
  fi
fi
echo "Static deployment complete" >&2