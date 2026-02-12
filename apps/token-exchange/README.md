# Token Exchange API

A separate service that exchanges third-party credentials for Documenso team API keys. Use this from mobile apps (e.g. Flutter) to provision signing access without requiring users to log in to Documenso directly.

**Main app:** https://sign.pinogy.com  
**Token Exchange:** https://sign-token.pinogy.com (or deploy as a separate Render service with a custom domain)

## Flow

1. Your app sends third-party credentials + organisation ID + team slug.
2. This service validates the credentials against your external system.
3. If valid: creates a team (if needed) or uses the existing team, creates an API token, returns it.
4. Your app uses the returned API key to call the Documenso API at `sign.pinogy.com`.

### Team already exists

If credentials are valid and the team already exists in the organisation, the service does **not** fail. It creates a new API token for the existing team and returns it. Each exchange yields a fresh token.

## API

### `POST /api/exchange`

**Authentication:** `Authorization: Bearer <TOKEN_EXCHANGE_SECRET>` or `X-API-Key: <TOKEN_EXCHANGE_SECRET>`

**Request body (JSON):**

```json
{
  "credentials": {
    "host": "https://api.pinogy.com",
    "accessKey": "your-pos-access-key",
    "secretKey": "your-pos-secret-key",
    "password": "your-pos-password",
    "appId": 4
  },
  "slug": "my-team",
  "organisationId": "clxx..."
}
```

- `credentials` – POS API credentials. Validated via `POST /apps/any/sessions` (sign_in). On success, `DELETE /apps/any/sessions/{id}` is called to clean up. `host` defaults to `https://` if omitted. `appId` defaults to `4` (CASH_REGISTER).
- `slug` – team URL slug (e.g. `my-team` → `https://sign.pinogy.com/t/my-team`).
- `organisationId` – Documenso organisation ID (from the main app).

**Success (200):**

```json
{
  "teamId": 123,
  "apiKey": "api_xxxxxxxxxxxxxxxx",
  "teamCreated": true
}
```

- `teamCreated: true` – team was created for this request.
- `teamCreated: false` – team already existed; a new token was issued for it.

**Errors:**

| Status | Code                  | Meaning                                |
|--------|-----------------------|----------------------------------------|
| 400    | INVALID_REQUEST       | Missing/invalid body fields            |
| 401    | UNAUTHORIZED          | Missing or invalid auth header         |
| 401    | INVALID_CREDENTIALS   | Third-party credentials invalid        |
| 404    | ORGANISATION_NOT_FOUND| Organisation ID not found              |
| 404    | INVALID_SLUG          | Slug empty or invalid after slugify    |
| 409    | TEAM_URL_TAKEN        | Team URL already used by another org   |

## Flutter example

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

const tokenExchangeUrl = 'https://sign-token.pinogy.com';  // or your Render URL
const documensoUrl = 'https://sign.pinogy.com';
const tokenExchangeSecret = 'your-TOKEN_EXCHANGE_SECRET';

Future<String?> exchangeForApiKey({
  required Map<String, String> credentials,
  required String slug,
  required String organisationId,
}) async {
  final response = await http.post(
    Uri.parse('$tokenExchangeUrl/api/exchange'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $tokenExchangeSecret',
    },
    body: jsonEncode({
      'credentials': credentials,
      'slug': slug,
      'organisationId': organisationId,
    }),
  );

  if (response.statusCode != 200) {
    final err = jsonDecode(response.body);
    throw Exception('${err['code'] ?? 'Unknown'}: ${err['error'] ?? response.body}');
  }

  final data = jsonDecode(response.body) as Map<String, dynamic>;
  return data['apiKey'] as String?;
}

// Usage
void main() async {
  final apiKey = await exchangeForApiKey(
    credentials: {
      'host': 'https://api.pinogy.com',
      'accessKey': 'your-pos-access-key',
      'secretKey': 'your-pos-secret-key',
      'password': 'your-pos-password',
    },
    slug: 'my-mobile-team',
    organisationId: 'clxx...',
  );
  if (apiKey != null) {
    // Use apiKey with Documenso API at documensoUrl
    // e.g. POST /api/v2/documents with Authorization: Bearer $apiKey
  }
}
```

## POS API integration

Credentials are validated against the Pinogy POS API (`POClient`):

1. **sign_in** – `POST /apps/any/sessions` with `accesskey`, `timestamp`, `signature` (HMAC-SHA256 of `path + timestamp` with `secretKey`), `password`, `app_id`. If 200 and response includes `token`, credentials are valid.
2. **sign_out** – `DELETE /apps/any/sessions/{id}` is called to clean up the session.

## Environment variables

| Key | Required | Description |
|-----|----------|-------------|
| `TOKEN_EXCHANGE_SECRET` | Yes | Secret for authenticating requests (Bearer or X-API-Key). |
| `NEXT_PRIVATE_DATABASE_URL` | Yes | Same as main app (Supabase pooler). |
| `NEXT_PRIVATE_DIRECT_DATABASE_URL` | Yes | Same as main app (Supabase direct). |

## Local development

```bash
npm run dev:token-exchange
# or
cd apps/token-exchange && npm run dev
```

Runs at http://localhost:3004.
