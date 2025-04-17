#!/usr/bin/env bash
# scripts/ssl_deploy.sh: Issue ACM certificate and update CloudFront
set -euo pipefail
# Load environment variables
if [ -f .env ]; then
  set -a; source .env; set +a
fi
# Ensure required variables DOMAIN and AWS_REGION
if [ -z "${DOMAIN:-}" ] || [ -z "${AWS_REGION:-}" ]; then
  echo "Error: DOMAIN and AWS_REGION must be set in .env" >&2
  exit 1
fi
# Check if CloudFront distribution ID provided
SKIP_CF=false
if [ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]; then
  echo "Warning: CLOUDFRONT_DISTRIBUTION_ID not set; skipping CloudFront update" >&2
  SKIP_CF=true
fi
# Normalize custom domain: strip protocol and trailing slash
HOST=$(echo "$DOMAIN" | sed -e 's~https\?://~~' -e 's~/$~~')
echo "Requesting ACM certificate for $HOST in region $AWS_REGION..."
# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --region "$AWS_REGION" \
  --domain-name "$HOST" \
  --validation-method DNS \
  --output text --query CertificateArn)
echo "Certificate requested: $CERT_ARN"
# Fetch DNS validation record
echo "Fetching DNS validation record..."
aws acm describe-certificate \
  --region "$AWS_REGION" \
  --certificate-arn "$CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' > dns_record.json
# Parse record
NAME=$(jq -r .Name dns_record.json)
VALUE=$(jq -r .Value dns_record.json)
echo "Upserting Route53 CNAME $NAME -> $VALUE"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "$HOST" \
  --query 'HostedZones[0].Id' --output text | sed 's#/hostedzone/##')
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$NAME\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$VALUE\"}]}}]}"
echo "Waiting for certificate validation..."
aws acm wait certificate-validated \
  --region "$AWS_REGION" \
  --certificate-arn "$CERT_ARN"
echo "Validation complete."
if [ "$SKIP_CF" = false ]; then
  echo "Updating CloudFront distribution $CLOUDFRONT_DISTRIBUTION_ID..."
  ETAG=$(aws cloudfront get-distribution-config --id "$CLOUDFRONT_DISTRIBUTION_ID" --query 'ETag' --output text)
  aws cloudfront get-distribution-config --id "$CLOUDFRONT_DISTRIBUTION_ID" > dist-config.json
  jq --arg arn "$CERT_ARN" '.DistributionConfig.ViewerCertificate={ACMCertificateArn:$arn,SSLSupportMethod:"sni-only",MinimumProtocolVersion:"TLSv1.2_2018",CertificateSource:"acm"}' dist-config.json > dist-updated.json
  aws cloudfront update-distribution --id "$CLOUDFRONT_DISTRIBUTION_ID" --if-match "$ETAG" --distribution-config file://dist-updated.json
  echo "CloudFront distribution updated."
else
  echo "Skipped CloudFront update."
fi
echo "SSL deployment complete for $HOST"