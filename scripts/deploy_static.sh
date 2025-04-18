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
# NOTE: Make sure AWS credentials and region are exported in the environment before running this script.
# Deploy static web files to S3 website bucket
HOST_BUCKET="facecontrolgame-static"
echo "Syncing local web/ folder to s3://$HOST_BUCKET" >&2
aws s3 sync web/ "s3://$HOST_BUCKET" --delete --region us-east-1
echo "Configuring website hosting on $HOST_BUCKET" >&2
aws s3 website "s3://$HOST_BUCKET" --index-document index.html --error-document index.html --region us-east-1
ENDPOINT="$HOST_BUCKET.s3-website-us-east-1.amazonaws.com"
echo "Static files deployed. Website endpoint: http://$ENDPOINT" >&2

# Optionally invalidate CloudFront distribution if provided
if [ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "Invalidating CloudFront distribution ${CLOUDFRONT_DISTRIBUTION_ID}" >&2
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*" >/dev/null 2>&1
  echo "CloudFront distribution ID provided - skipping Route53 update to preserve CloudFront configuration" >&2
else
  # Only update Route53 to point to S3 directly if no CloudFront distribution ID is provided
  if [ -n "${DOMAIN:-}" ]; then
    HOST=$(echo "$DOMAIN" | sed -E 's~https?://~~' | sed 's~/$~~')
    echo "Updating Route53 record for $HOST" >&2
    if [ -n "${HOSTED_ZONE_ID:-}" ]; then
      ZONE_ID="$HOSTED_ZONE_ID"
    else
      ZONE_ID=$(aws route53 list-hosted-zones-by-name --dns-name "$HOST" \
        --query 'HostedZones[?Config.PrivateZone==`false`].Id | [0]' --output text | sed 's#/hostedzone/##')
    fi
    if [ -z "$ZONE_ID" ] || [ "$ZONE_ID" = "None" ]; then
      echo "Warning: Hosted zone for $HOST not found; skipping Route53 update" >&2
    else
      S3_ZONE_ID="Z3AQBSTGFYJSTF" # us-east-1
      ENDPOINT="$HOST_BUCKET.s3-website-us-east-1.amazonaws.com"
      echo "Upserting alias A record $HOST -> $ENDPOINT (zone $ZONE_ID)" >&2
      CHANGE_ID=$(aws route53 change-resource-record-sets \
        --hosted-zone-id "$ZONE_ID" \
        --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$HOST\",\"Type\":\"A\",\"AliasTarget\":{\"HostedZoneId\":\"$S3_ZONE_ID\",\"DNSName\":\"$ENDPOINT\",\"EvaluateTargetHealth\":false}}}]}" \
        --query ChangeInfo.Id --output text)
      echo "Waiting for Route53 change $CHANGE_ID to INSYNC..." >&2
      aws route53 wait resource-record-sets-changed --id "$CHANGE_ID"
    fi
  fi
fi
echo "Static deployment complete" >&2