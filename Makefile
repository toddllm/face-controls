SHELL := /usr/bin/env bash
# Load environment variables
export $(shell sed 's/=.*//' .env)

.PHONY: serve deploy-static deploy

serve:
	@echo "Running backend server..."
	@bash scripts/run_backend.sh

deploy-static:
	@echo "Deploying static files to S3..."
	@bash scripts/deploy_static.sh

deploy: deploy-static
	@echo "Deployment complete."

# SSL workflow is now handled by scripts/ssl_deploy.sh
.PHONY: ssl-deploy

# Request an ACM certificate with DNS validation
request-cert:
	@command -v aws >/dev/null 2>&1 || { echo "Error: AWS CLI not found." >&2; exit 1; }
	@command -v jq >/dev/null 2>&1 || { echo "Error: jq not found." >&2; exit 1; }
	# Trim protocol and trailing slash
	@HOST=$${DOMAIN#*://}; HOST=$${HOST%/}; \
	@echo "Requesting ACM certificate for $$HOST..."
	@ARN=$$(aws acm request-certificate --region $${AWS_REGION} --domain-name "$$HOST" --validation-method DNS --output text --query CertificateArn)
	@echo $$ARN > .cert_arn
	@echo "Certificate ARN: $$ARN"
	@aws acm describe-certificate --region $${AWS_REGION} --certificate-arn $$ARN --query 'Certificate.DomainValidationOptions[0].ResourceRecord' > dns_record.json
	@ZONE_ID=$$(aws route53 list-hosted-zones-by-name --dns-name "$$HOST" --query 'HostedZones[0].Id' --output text | sed 's#/hostedzone/##')
	@NAME=$$(jq -r .Name dns_record.json)
	@VAL=$$(jq -r .Value dns_record.json)
	@echo "Upserting DNS record $$NAME -> $$VAL in zone $$ZONE_ID"
	@aws route53 change-resource-record-sets --hosted-zone-id $$ZONE_ID --change-batch "{\"Changes\":[{\"Action\":\"UPSERT\",\"ResourceRecordSet\":{\"Name\":\"$$NAME\",\"Type\":\"CNAME\",\"TTL\":300,\"ResourceRecords\":[{\"Value\":\"$$VAL\"}]}}]}"
	@echo "Validation record created. Run 'make wait-cert' after DNS propagation."

# Wait for ACM certificate to be validated
# Wait for ACM certificate to be validated
wait-cert:
	@echo "Waiting for certificate validation..."
	@ARN=$$(cat .cert_arn)
	@aws acm wait certificate-validated --region $${AWS_REGION} --certificate-arn $$ARN
	@echo "Certificate validated: $$ARN"

# Update CloudFront distribution to use the ACM certificate
# Update CloudFront distribution to use the ACM certificate
update-cloudfront:
	@echo "Updating CloudFront distribution $(CLOUDFRONT_DISTRIBUTION_ID) with new ACM certificate..."
	@ETAG=$$(aws cloudfront get-distribution-config --id $${CLOUDFRONT_DISTRIBUTION_ID} --query 'ETag' --output text)
	@aws cloudfront get-distribution-config --id $${CLOUDFRONT_DISTRIBUTION_ID} > dist-config.json
	@ARN=$$(cat .cert_arn)
	@jq --arg arn "$$ARN" '.DistributionConfig.ViewerCertificate = {ACMCertificateArn: $arn, SSLSupportMethod: "sni-only", MinimumProtocolVersion: "TLSv1.2_2018", CertificateSource: "acm"}' dist-config.json > dist-config-updated.json
	@aws cloudfront update-distribution --id $${CLOUDFRONT_DISTRIBUTION_ID} --if-match $$ETAG --distribution-config file://dist-config-updated.json
	@echo "CloudFront distribution updated."

# Full SSL workflow: request -> wait -> update CloudFront
ssl-deploy:
	@bash scripts/ssl_deploy.sh
.PHONY: start stop
start:
	bash scripts/start.sh

stop:
	bash scripts/stop.sh
