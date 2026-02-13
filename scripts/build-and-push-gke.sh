#!/usr/bin/env bash
# Build and push Documenso images to Google Artifact Registry for GKE deployment.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - Docker installed
#   - Artifact Registry API enabled (gcloud services enable artifactregistry.googleapis.com)
#
# Usage:
#   ./scripts/build-and-push-gke.sh [tag]                    # build and push both
#   ./scripts/build-and-push-gke.sh [tag] --app-only         # build and push documenso-app only
#   ./scripts/build-and-push-gke.sh [tag] --push-only        # push only (skip build)
#
# Environment variables (optional):
#   GCP_PROJECT_ID  - GCP project (default: from gcloud config)
#   GCP_REGION      - Artifact Registry region (default: us-central1)
#   REPO_NAME       - Artifact Registry repo name (default: documenso)
#
# Examples:
#   ./scripts/build-and-push-gke.sh                    # uses tag "latest"
#   ./scripts/build-and-push-gke.sh v1.2.3             # uses tag v1.2.3
#   GCP_REGION=us-east1 ./scripts/build-and-push-gke.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PUSH_ONLY=false
APP_ONLY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --push-only) PUSH_ONLY=true; shift ;;
    --app-only)  APP_ONLY=true; shift ;;
    *) break ;;
  esac
done
TAG="${1:-latest}"
GCP_PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
GCP_REGION="${GCP_REGION:-us-central1}"
REPO_NAME="${REPO_NAME:-documenso}"

if [[ -z "$GCP_PROJECT_ID" ]]; then
  echo "Error: GCP_PROJECT_ID not set and gcloud project not configured."
  echo "Run: gcloud config set project YOUR_PROJECT_ID"
  echo "Or: GCP_PROJECT_ID=your-project ./scripts/build-and-push-gke.sh"
  exit 1
fi

REGISTRY="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${REPO_NAME}"
DOCUMENSO_APP_IMAGE="${REGISTRY}/documenso-app:${TAG}"
TOKEN_EXCHANGE_IMAGE="${REGISTRY}/token-exchange:${TAG}"

if [[ "$PUSH_ONLY" == true ]]; then
  echo "==> Pushing to ${REGISTRY}"
else
  echo "==> Building and pushing to ${REGISTRY}"
fi
echo "    Tag: ${TAG}"
[[ "$PUSH_ONLY" == true ]] && echo "    (push only - skipping build)"
echo ""

# Ensure Artifact Registry repo exists
echo "==> Ensuring Artifact Registry repository ${REPO_NAME} exists..."
if ! gcloud artifacts repositories describe "$REPO_NAME" \
  --location="$GCP_REGION" \
  --project="$GCP_PROJECT_ID" 2>/dev/null; then
  echo "    Creating repository ${REPO_NAME}..."
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --project="$GCP_PROJECT_ID" \
    --description="Documenso container images"
fi

# Configure Docker to use gcloud as credential helper for Artifact Registry
echo ""
echo "==> Configuring Docker for Artifact Registry..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

if [[ "$PUSH_ONLY" != true ]]; then
  # Build documenso-app (main Remix app)
  echo ""
  echo "==> Building documenso-app..."
  docker build \
    -t "$DOCUMENSO_APP_IMAGE" \
    -f "$REPO_ROOT/docker/Dockerfile" \
    "$REPO_ROOT"

  if [[ "$APP_ONLY" != true ]]; then
    # Build token-exchange
    echo ""
    echo "==> Building token-exchange..."
    docker build \
      -t "$TOKEN_EXCHANGE_IMAGE" \
      -f "$REPO_ROOT/docker/Dockerfile.token-exchange" \
      "$REPO_ROOT"
  fi
fi

# Push images
echo ""
echo "==> Pushing images..."
docker push "$DOCUMENSO_APP_IMAGE"
if [[ "$APP_ONLY" != true ]]; then
  docker push "$TOKEN_EXCHANGE_IMAGE"
fi

echo ""
echo "==> Done! Images pushed:"
echo "    documenso-app:  ${DOCUMENSO_APP_IMAGE}"
if [[ "$APP_ONLY" != true ]]; then
  echo "    token-exchange: ${TOKEN_EXCHANGE_IMAGE}"
fi
echo ""
echo "==> Deploy documenso-app:"
echo "    kubectl set image deployment/documenso-app documenso-app=${DOCUMENSO_APP_IMAGE} -n sign"
echo "    # or: kubectl apply -f k8s/sign/documenso-app.yaml -n sign"
if [[ "$APP_ONLY" != true ]]; then
  echo ""
  echo "==> Deploy token-exchange:"
  echo "    kubectl set image deployment/token-exchange token-exchange=${TOKEN_EXCHANGE_IMAGE} -n sign"
fi
