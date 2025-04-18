# Face Controls Module

Standalone demo application for controlling an avatar with webcam and voice input.

## Requirements
- Python 3.7+
- pip

## Install
```bash
pip install -r requirements.txt
```

## Usage
```bash
python main.py
```

Press 'q' in the webcam window or close the window to exit.

## Web Front-end and API Server

This repository includes a FastAPI backend (`server.py`) serving the API and static files, and a browser-based front-end in the `web/` directory.

### Running Locally
1. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the FastAPI server (serves both API and static front-end):
   ```bash
   make serve
   ```
4. Open your browser to `http://localhost:8000/` to access the app.

### Deployment to AWS S3 (Static Site)
Configure AWS credentials and target domain in `.env` (see `.env.example`):
```bash
# Custom domain (must match Route53 hosted zone and will be used as the bucket name)
DOMAIN=your-domain.com
# (optional) CloudFront distribution ID for cache invalidation
CLOUDFRONT_DISTRIBUTION_ID=YOUR_DISTRIBUTION_ID
```
Then deploy static assets:
```bash
make deploy-static
```
This will:
  - Create (if missing) and sync the `web/` directory to an S3 bucket named for your domain
  - Configure S3 static website hosting on that bucket (index and error documents)
  - Update the Route53 A record for your custom domain to point to the S3 website endpoint
  - Invalidate CloudFront distribution if `CLOUDFRONT_DISTRIBUTION_ID` is set

### SSL via AWS ACM

The following Makefile targets automate ACM certificate issuance and deployment using DNS validation:

Requirements:
- AWS CLI v2 configured with permissions for ACM and Route53
- `jq` installed locally

In your `.env`, ensure the following are set:
```bash
DOMAIN=your-domain.com              # no protocol
CLOUDFRONT_DISTRIBUTION_ID=YOUR_ID  # CloudFront distribution to update
```

Available targets:
- `make request-cert`  : Requests an ACM certificate and creates the DNS validation CNAME record in Route53
- `make wait-cert`     : Waits until the ACM certificate is validated
- `make update-cloudfront`: Updates your CloudFront distribution to use the validated ACM certificate
- `make ssl-deploy`    : Runs `request-cert`, `wait-cert`, and `update-cloudfront` in sequence

Usage:
```bash
make ssl-deploy
```
This will issue the certificate, validate it via DNS, and attach it to CloudFront.

## Current Deployment Status

### Website Access
- **CloudFront URL (HTTPS)**: https://d2d8a57hfnkz6k.cloudfront.net
- **Custom Domain**: https://facecontrolgame.com (DNS propagation in progress)

### Infrastructure Status
- **S3 Bucket**: facecontrolgame.com (configured for website hosting)
- **CloudFront**: Distribution ID: E15E4MBKLEWK2U (in progress)
- **SSL Certificate**: Pending validation
- **Route53**: Configured with A record pointing to CloudFront

### Notes
- For camera access, use the CloudFront URL while waiting for DNS propagation
- The website is accessible via both S3 direct URL and CloudFront, but camera features require HTTPS (CloudFront)

Start and Stop:
```bash
make start  # start the server in background
make stop   # stop the server
```

---

Test: This line was updated to trigger another GitHub Actions deploy.
