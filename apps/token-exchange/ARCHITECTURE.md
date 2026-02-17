# Token Exchange Architecture

## Principle: Token-exchange is the wrapper, not Documenso

**Do not modify the main Documenso app** (`apps/remix`, `packages/trpc`, `packages/api`, etc.) to add features for this integration. All new logic belongs in the **token-exchange app** (`apps/token-exchange`).

## Why

- **Documenso** is the upstream/open-source document signing platform with its own API.
- **Token-exchange** is a separate service that wraps Documenso and provides integration-specific features (credential exchange, document requests, template workflows, etc.).
- Modifying Documenso creates merge conflicts with upstream, complicates upgrades, and blurs the boundary between the platform and the integration.

## How token-exchange works

1. **Wraps the Documenso API** – Proxies requests to Documenso (e.g. templates, create-envelope) when the API already supports what we need.
2. **Talks to the database** – Uses `@documenso/prisma` and `@documenso/lib` when we need behavior that Documenso’s API doesn’t expose.
## Where to write code

| Need | Write in |
|------|----------|
| New API endpoints for mobile/integration | `apps/token-exchange/app/api/` |
| Documenso API client calls | `apps/token-exchange/lib/documenso-client.ts` |
| Credential validation, exchange logic | `apps/token-exchange/lib/` |
| Database access for features Documenso doesn’t expose | `apps/token-exchange/` (using `@documenso/prisma`, `@documenso/lib`) |

## What not to do

- Do **not** add routes to `packages/trpc` or `packages/api` for token-exchange features.
- Do **not** change Documenso’s API v1/v2 behavior to suit token-exchange.
- Do **not** modify `apps/remix` for integration-specific flows.

## When Documenso’s API is insufficient

If Documenso doesn’t expose what we need:

1. Implement the logic in token-exchange using `@documenso/lib` server-only functions and `@documenso/prisma`.
2. Expose it as a token-exchange API route.
3. Keep Documenso unchanged.
