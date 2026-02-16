# Troubleshooting: "Something went wrong" on login

When login fails with a generic "Something went wrong" and logs show little detail, check the following.

## 1. URL / Origin mismatch (most common with custom domains)

If you use a custom domain (e.g. `sign.pinogy.com`) but the app was built with the default Render URL, auth will fail.

**Fix:** In the Render dashboard, for **documenso-app** → **Environment**, set these explicitly (do not rely on `fromService` alone):

| Variable | Value |
|----------|-------|
| `NEXTAUTH_URL` | `https://sign.pinogy.com` |
| `NEXT_PUBLIC_WEBAPP_URL` | `https://sign.pinogy.com` |
| `NEXT_PRIVATE_INTERNAL_WEBAPP_URL` | `https://sign.pinogy.com` |

Then run **Manual Deploy** so the app is rebuilt with the correct URLs.

The auth middleware rejects requests when the `Origin` header does not match `NEXT_PUBLIC_WEBAPP_URL`. If you visit `sign.pinogy.com` but the app thinks the URL is `*.onrender.com`, you get a 403 or 500.

## 2. Get the real error from logs

The generic message hides the actual error. To see it:

1. In Render: **documenso-app** → **Logs**
2. Try to log in again
3. Look for lines right after the failed request, especially:
   - `Unknown Error:` (from auth error handler)
   - `Error setting signed cookie`
   - Stack traces or Prisma errors

## 3. Check the response in the browser

1. Open DevTools (F12) → **Network**
2. Try to log in
3. Find the failing request (e.g. `authorize` or `csrf`)
4. Check **Response** and **Headers**:
   - **403** → Origin mismatch (see #1)
   - **500** → Server error; check Render logs for the stack trace

## 4. Cookie / domain issues

Cookies use the hostname from `NEXT_PUBLIC_WEBAPP_URL`. If that is wrong, cookies may be set for the wrong domain and not sent on subsequent requests.

## 5. NEXTAUTH_SECRET

Ensure `NEXTAUTH_SECRET` is set in the Environment tab. If it is missing, cookie signing fails.
