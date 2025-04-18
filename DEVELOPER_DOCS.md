# Developer Onboarding & Deployment Guide

## Overview
This project uses a modern, secure, and scalable deployment process powered by GitHub Actions. All production deploys are handled by automation—no developer needs direct AWS credentials for deploys.

## Why GitHub Actions?
- **Security:** No root or personal AWS credentials are used for deploys.
- **Auditability:** All deploys are logged in GitHub Actions.
- **Scalability:** Any authorized contributor can trigger a deploy.

## AWS Setup
- **S3 Bucket:** `facecontrolgame-static` (for static web assets)
- **CloudFront Distribution:** `E15E4MBKLEWK2U` (for HTTPS and CDN)
- **Route53:** Used for DNS and custom domain
- **IAM Deploy User:** `facecontrol-deployer` (created by root, used only by GitHub Actions)

## How Deploy Works
- On push to `main`, GitHub Actions will:
  1. Build the web assets (if needed)
  2. Sync the `web/` directory to the S3 bucket
  3. Invalidate the CloudFront cache
- All AWS credentials are stored as GitHub repo secrets.

## Adding a New Developer
- No AWS credentials are needed for deploys.
- To contribute code, fork and PR as usual.
- To trigger a deploy, merge to `main` (or use the Actions tab for manual deploys).

## Updating AWS Secrets
- Only repo admins can update GitHub secrets.
- If the deploy IAM user's keys are rotated, update the following secrets:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_REGION` (should be `us-east-1`)
  - `S3_BUCKET` (should be `facecontrolgame-static`)
  - `CLOUDFRONT_DISTRIBUTION_ID` (should be `E15E4MBKLEWK2U`)

## GitHub Actions Workflow
- The workflow file is `.github/workflows/deploy.yml`.
- It runs on push to `main`.
- It can also be triggered manually from the Actions tab.
- Logs are available in the Actions tab for each run.

## Troubleshooting
- Check the Actions tab for logs and errors.
- If deploy fails, check AWS permissions and secrets.
- For S3/CloudFront/Route53 issues, see the AWS Console.

## Security Best Practices
- Never use root credentials for deploys.
- Only the deploy IAM user should have write access to the S3 bucket and CloudFront.
- Rotate deploy keys regularly.
- Use least privilege for all IAM policies.

---
For questions, contact the project maintainer or check the repo wiki. 