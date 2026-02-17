# Troubleshooting: Documents Stuck in Pending

When documents stay in **PENDING** (awaiting signatures) and the cause is usually wrong URLs or auth after a deployment move (e.g. Render → GKE).

## What “stuck in pending” means

- **PENDING** = document has been sent and is waiting for signatures.
- “Stuck” = recipients open the signing link but it fails (404, 403, 500, or the page doesn’t load).

## Common causes after moving (Render → GKE)

### 1. After sign: seal job never runs (`NEXT_PRIVATE_INTERNAL_WEBAPP_URL`)

When all recipients have signed, the app triggers an internal **seal-document** job by POSTing to `${NEXT_PRIVATE_INTERNAL_WEBAPP_URL}/api/jobs/...`. If this request fails, the document stays PENDING.

**Common causes:**
- URL still points to old deployment (e.g. Render) – request goes to wrong/unreachable host
- **GKE hairpin NAT** – Pod uses external URL (`https://sign.pinogy.com`) to reach itself; some clusters can't route that correctly

**Fix for GKE:** Use the **internal Kubernetes service URL** so the pod reaches itself via the cluster network (no external LB, no hairpin):

```
NEXT_PRIVATE_INTERNAL_WEBAPP_URL=http://documenso-app
```

The service name and namespace must match your deployment (e.g. `documenso-app` in namespace `sign`). For cross-namespace: `http://documenso-app.sign.svc.cluster.local`.

**Fix for Render / single-server:** Use the public URL:

```
NEXT_PRIVATE_INTERNAL_WEBAPP_URL=https://sign.pinogy.com
```

Use the URL **without** a trailing slash.

**Verify:** Check documenso-app logs for `Submitting job to endpoint:` – confirm the URL is reachable from the pod. If the seal job fails, you may see fetch errors or timeouts.

---

### 2. Token-exchange: wrong signing URL

Token-exchange builds signing URLs with `NEXT_PUBLIC_WEBAPP_URL`. If this is missing or wrong, links point to the wrong host (e.g. `http://localhost:3000/sign/...` or an old Render URL).

**Fix:** Add to `token-exchange-secrets`:

```
NEXT_PUBLIC_WEBAPP_URL=https://sign.pinogy.com
```

Use your real Documenso domain. This must be the main app URL where users sign, not the token-exchange URL.

**Verify:** Create an envelope via token-exchange and inspect the `signingUrl` in the response. It should be `https://sign.pinogy.com/sign/{token}` (or your domain).

---

### 3. Main app: URL / Origin mismatch

If `NEXTAUTH_URL`, `NEXT_PUBLIC_WEBAPP_URL`, or `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` still point to Render (e.g. `*.onrender.com`), the signing page can reject requests due to Origin mismatch.

**Fix:** In `documenso-secrets`, set all three to your custom domain:

| Variable | Value |
|----------|-------|
| `NEXTAUTH_URL` | `https://sign.pinogy.com` |
| `NEXT_PUBLIC_WEBAPP_URL` | `https://sign.pinogy.com` |
| `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` | `https://sign.pinogy.com` |

Then redeploy the main app so it’s built with these values.

See [TROUBLESHOOTING-LOGIN.md](./TROUBLESHOOTING-LOGIN.md) for more on auth/Origin issues.

---

### 4. Database mismatch

Both apps must use the same database. If token-exchange and documenso-app point at different DBs, documents created by one won’t be visible to the other.

**Verify:** `NEXT_PRIVATE_DATABASE_URL` and `NEXT_PRIVATE_DIRECT_DATABASE_URL` are identical in both `documenso-secrets` and `token-exchange-secrets` (or shared correctly).

---

### 5. GKE: update secrets and redeploy

After changing secrets:

```bash
# Update token-exchange secret (add NEXT_PUBLIC_WEBAPP_URL)
kubectl create secret generic token-exchange-secrets \
  --from-literal=TOKEN_EXCHANGE_SECRET='...' \
  --from-literal=NEXT_PUBLIC_WEBAPP_URL='https://sign.pinogy.com' \
  --from-literal=NEXT_PRIVATE_DATABASE_URL='postgresql://...' \
  --from-literal=NEXT_PRIVATE_DIRECT_DATABASE_URL='postgresql://...' \
  --from-literal=DOCUMENSO_URL='https://sign.pinogy.com' \
  -n sign --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new env
kubectl rollout restart deployment token-exchange -n sign
kubectl rollout restart deployment documenso-app -n sign
```

---

## Quick checklist

| Check | Where | Expected |
|-------|-------|----------|
| **After sign:** Seal job endpoint | documenso-secrets | `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` = main app URL |
| Signing URL in create-envelope response | Token-exchange | `https://sign.pinogy.com/sign/{token}` |
| `NEXT_PUBLIC_WEBAPP_URL` | token-exchange-secrets | Main app URL |
| `NEXTAUTH_URL` | documenso-secrets | Main app URL |
| `NEXT_PUBLIC_WEBAPP_URL` | documenso-secrets | Main app URL |
| Same database | Both secrets | Same `NEXT_PRIVATE_DATABASE_URL` |

---

## Testing

**Before sign:**
1. Create an envelope via token-exchange `POST /api/template/{id}/create-envelope`.
2. Copy the `signingUrl` from the response.
3. Open it in a browser (incognito is fine).
4. You should see the Documenso signing page. If you get 404, 403, 500, or a blank page, the URL/env config is wrong.

**After sign:**
1. Complete a signing flow (fill fields, sign, click complete).
2. The document should move to COMPLETED within a few seconds.
3. If it stays PENDING, check documenso-app logs for `Submitting job to endpoint:` and any fetch errors. Ensure `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` points to your GKE domain.
