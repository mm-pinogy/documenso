#!/bin/bash
# Install cert-manager with Gateway API support for Let's Encrypt
# Run from repo root. Requires Helm 3 and kubectl configured.
# Usage: ./k8s/sign/cert-manager-install.sh

set -e

echo "Adding Jetstack Helm repo..."
helm repo add jetstack https://charts.jetstack.io 2>/dev/null || true
helm repo update

echo "Installing cert-manager with Gateway API support..."
helm upgrade --install cert-manager oci://quay.io/jetstack/charts/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true \
  --set "config.apiVersion=controller.config.cert-manager.io/v1alpha1" \
  --set "config.kind=ControllerConfiguration" \
  --set "config.enableGatewayAPI=true"

echo ""
echo "Waiting for cert-manager to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=120s

echo ""
echo "cert-manager installed. Next: kubectl apply -f k8s/sign/cert-manager.yaml -n sign"
