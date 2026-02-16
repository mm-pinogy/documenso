# Documenso on GKE (namespace: sign)

Kubernetes manifests for deploying Documenso (documenso-app + token-exchange) to an existing GKE cluster in the `sign` namespace.

## Prerequisites

- GKE cluster with `sign` namespace created
- `kubectl` configured for your cluster

## Database options

**Option A: In-cluster Postgres** (included in this folder)

```bash
kubectl create secret generic postgres-credentials -n sign \
  --from-literal=POSTGRES_USER=documenso \
  --from-literal=POSTGRES_PASSWORD='your-secure-password' \
  --from-literal=POSTGRES_DB=documenso

kubectl apply -f k8s/sign/postgres.yaml -n sign
```

Connection URL: `postgresql://documenso:your-secure-password@postgres:5432/documenso`

**Option B: External database** (Cloud SQL, Render Postgres, etc.) – set `NEXT_PRIVATE_DATABASE_URL` and `NEXT_PRIVATE_DIRECT_DATABASE_URL` in your app secrets.

## Quick Start

### 1. Build and push images

**Option A: GitHub Actions** (recommended for CI/CD)

1. Add in **Settings → Secrets and variables → Actions**:
   - **Secrets:** `GCP_SA_KEY` (required) – JSON key for a GCP service account with **Artifact Registry Writer** (and **Kubernetes Engine Developer** if using deploy step)
   - **Secrets or variables** (for deploy step): `GKE_CLUSTER`, `GKE_ZONE` – variables are fine since these aren't sensitive
   - **Optional:** `GKE_PROJECT` – GCP project; defaults to `pinogy-websites`

2. Go to **Actions → Build and deploy to GKE → Run workflow**. Choose tag (default `latest`), optionally enable deploy.

**Option B: Local script**

```bash
# From repo root - uses gcloud project from config
./scripts/build-and-push-gke.sh

# Or with custom project/region
GCP_PROJECT_ID=my-project GCP_REGION=us-east1 ./scripts/build-and-push-gke.sh v1.0.0
```

### 2. Create secrets

If using in-cluster Postgres, create `postgres-credentials` first (see Database options above). Then for the apps:

```bash
# documenso-app - create from your .env or manually
kubectl create secret generic documenso-secrets \
  --from-literal=NEXTAUTH_SECRET='...' \
  --from-literal=NEXTAUTH_URL='https://sign.pinogy.com' \
  --from-literal=NEXT_PUBLIC_WEBAPP_URL='https://sign.pinogy.com' \
  --from-literal=NEXT_PRIVATE_INTERNAL_WEBAPP_URL='https://sign.pinogy.com' \
  --from-literal=NEXT_PRIVATE_DATABASE_URL='postgresql://...' \
  --from-literal=NEXT_PRIVATE_DIRECT_DATABASE_URL='postgresql://...' \
  --from-literal=NEXT_PRIVATE_ENCRYPTION_KEY='...' \
  --from-literal=NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY='...' \
  -n sign
# Add SMTP and other vars from DEPLOY.md

# token-exchange
kubectl create secret generic token-exchange-secrets \
  --from-literal=TOKEN_EXCHANGE_SECRET='...' \
  --from-literal=NEXT_PRIVATE_DATABASE_URL='postgresql://...' \
  --from-literal=NEXT_PRIVATE_DIRECT_DATABASE_URL='postgresql://...' \
  --from-literal=DOCUMENSO_URL='https://sign.pinogy.com' \
  -n sign
```

Or from env files:

```bash
kubectl create secret generic documenso-secrets --from-env-file=.env.production -n sign
kubectl create secret generic token-exchange-secrets --from-env-file=.env.token-exchange -n sign
```

### 3. Update image references

Edit `documenso-app.yaml` and `token-exchange.yaml` and replace `YOUR_PROJECT` with your GCP project ID in the `image:` fields.

### 4. Deploy

If using in-cluster Postgres, deploy it first and wait for it to be ready:

```bash
kubectl apply -f k8s/sign/postgres.yaml -n sign
kubectl wait --for=condition=ready pod -l app=postgres -n sign --timeout=120s
```

Then deploy the apps:

```bash
kubectl apply -f k8s/sign/documenso-app.yaml -n sign
kubectl apply -f k8s/sign/token-exchange.yaml -n sign
```

### 5. Create your first user

**Option A: Sign up** (if signup is enabled)

1. Go to your app URL (e.g. `https://sign.pinogy.com`).
2. Click Sign up and create an account.
3. To promote to admin: run `npm run promote:admin your@email.com` with `.env` pointing at your DB (see Option C).

**Option B: Seed dev users** (creates example@documenso.com and admin@documenso.com, password: `password`)

```bash
# Port-forward to Postgres, then with .env NEXT_PRIVATE_DATABASE_URL=postgresql://... run:
kubectl port-forward svc/postgres 5432:5432 -n sign &
npm run prisma:seed
```

**Option C: Promote existing user to admin**

```bash
# Create .env with NEXT_PRIVATE_DATABASE_URL pointing at your Postgres.
# For in-cluster Postgres, port-forward first: kubectl port-forward svc/postgres 5432:5432 -n sign
# Then: NEXT_PRIVATE_DATABASE_URL=postgresql://documenso:PASSWORD@localhost:5432/documenso

npm run promote:admin your@email.com
```

## 6. Expose via GKE Gateway (recommended)

The `gateway.yaml` uses a dedicated Gateway with static IP `pinogy-apps` and routes:
- `sign.pinogy.com` → `documenso-app:80`
- `sign-token.pinogy.com` → `token-exchange:80`

HTTPS is provided by cert-manager + Let's Encrypt. HTTP redirects to HTTPS.

**Prerequisites:**
- Gateway API enabled: `gcloud container clusters update CLUSTER_NAME --location=LOCATION --gateway-api=standard`
- Static IP created: `./k8s/sign/static-ip.sh` (or `gcloud compute addresses create pinogy-apps --global`)
- DNS: Point `sign.pinogy.com` and `sign-token.pinogy.com` to the Gateway IP **before** requesting certificates

**Deploy (in order):**
```bash
# 1. Gateway and app routes
kubectl apply -f k8s/sign/gateway.yaml -n sign

# 2. Install cert-manager with Gateway API support
./k8s/sign/cert-manager-install.sh

# 3. Remove app routes (GKE shares HTTP/HTTPS URL map, so they block ACME)
kubectl delete httproute sign-app-route sign-token-route -n sign

# 4. Request certificate, then restore app routes
kubectl delete certificate sign-tls -n sign 2>/dev/null || true
kubectl apply -f k8s/sign/cert-manager.yaml -n sign
kubectl wait --for=condition=ready certificate sign-tls -n sign --timeout=300s
kubectl apply -f k8s/sign/gateway.yaml -n sign
```

Get the Gateway IP:
```bash
kubectl get gateway sign-gateway -n sign -o=jsonpath="{.status.addresses[0].value}"
```

**Note:** Edit `cert-manager.yaml` and set `email` in the ClusterIssuer to your address for Let's Encrypt expiry notifications. Use `letsencrypt-staging` in the Certificate's `issuerRef` for testing to avoid rate limits.

**If HTTP-01 fails** (GKE Gateway shares URL map, causing 404): use DNS-01 via Cloudflare. Create a Cloudflare API token (Zone Read + DNS Edit), store it in a Secret, then `kubectl apply -f k8s/sign/cert-manager-dns01.yaml -n sign`. See comments in that file.

## Files

| File | Description |
|------|--------------|
| `postgres.yaml` | PostgreSQL 18 (Alpine) – PVC, Deployment, Service |
| `documenso-app.yaml` | Deployment + Service for main app |
| `token-exchange.yaml` | Deployment + Service for token-exchange |
| `gateway.yaml` | GKE Gateway + HTTPRoutes + HealthCheckPolicies |
| `cert-manager.yaml` | ClusterIssuers (Let's Encrypt HTTP-01) + Certificate |
| `cert-manager-dns01.yaml` | DNS-01 alternative when HTTP-01 fails on GKE Gateway |
| `cert-manager-install.sh` | Install cert-manager with Gateway API support |
| `static-ip.sh` | Script to create global static IP `pinogy-apps` |
| `secret-example.yaml` | Example secret creation commands |

## Image pull authentication

If your GKE cluster is in the same GCP project as Artifact Registry, the default node service account can usually pull images. Otherwise, create a pull secret:

```bash
kubectl create secret docker-registry gcr-pull-secret \
  --docker-server=us-central1-docker.pkg.dev \
  --docker-username=oauth2accesstoken \
  --docker-password="$(gcloud auth print-access-token)" \
  -n sign
```

Then add `imagePullSecrets: [{ name: gcr-pull-secret }]` to the Deployment spec.
