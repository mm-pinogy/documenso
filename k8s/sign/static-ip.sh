#!/bin/bash
# Create global static IP for pinogy-apps (used by the sign Gateway)
# Run from repo root or set GCP_PROJECT_ID
# Usage: ./k8s/sign/static-ip.sh

set -e
PROJECT="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
if [ -z "$PROJECT" ]; then
  echo "Set GCP_PROJECT_ID or run gcloud config set project YOUR_PROJECT"
  exit 1
fi

echo "Creating global static IP 'pinogy-apps' in project $PROJECT"
gcloud compute addresses create pinogy-apps --global --project="$PROJECT"

echo ""
echo "IP created. Get the address with:"
echo "  gcloud compute addresses describe pinogy-apps --global --format='get(address)'"
echo ""
echo "Point sign.pinogy.com and sign-token.pinogy.com to this IP in your DNS."
