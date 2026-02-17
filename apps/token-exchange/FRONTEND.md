# Token Exchange – Frontend Integration Guide

Quick reference for integrating the token-exchange API from a web or mobile frontend.

## URLs

| Service | Base URL | Use for |
|----------|----------|---------|
| **Token Exchange** | `https://sign-token.pinogy.com` | Exchange, templates, create template, create-envelope |
| **Documenso (signing)** | `https://sign.pinogy.com` | Signing links, main app UI |

**Important:** Templates and create-envelope live on the **token-exchange** URL, not the main app.

## Authentication

Two different auth values:

| Header | Value | Used for |
|--------|-------|----------|
| `Authorization: Bearer <secret>` or `X-API-Key: <secret>` | `TOKEN_EXCHANGE_SECRET` | All token-exchange endpoints |
| `X-Documenso-API-Key` or `apiKey` query param | Documenso API key from `/api/exchange` | Templates, create-envelope (identifies the team) |

## Endpoints

### 1. Exchange credentials for API key

```
POST /api/exchange
```

**Headers:** `Authorization: Bearer <TOKEN_EXCHANGE_SECRET>` (or `X-API-Key`)

**Body:**
```json
{
  "credentials": {
    "host": "https://api.pinogy.com",
    "accessKey": "your-access-key",
    "secretKey": "your-secret-key"
  },
  "slug": "my-team",
  "organisationId": "clxx..."
}
```

**Success (200):**
```json
{
  "teamId": 123,
  "apiKey": "api_xxxxxxxxxxxxxxxx",
  "teamCreated": true
}
```

Store `apiKey` for subsequent calls to templates and create-envelope.

---

### 2. List templates

```
GET /api/templates?apiKey=<apiKey>&page=1&perPage=10
```

**Headers:** `Authorization: Bearer <TOKEN_EXCHANGE_SECRET>` (or `X-API-Key`)

**Documenso API key:** `X-Documenso-API-Key` header **or** `apiKey` query param (required)

**Success (200):**
```json
{
  "templates": [
    {
      "id": 1,
      "externalId": null,
      "type": "GENERAL",
      "title": "Contract",
      "userId": 1,
      "teamId": 1,
      "createdAt": "2025-02-16T...",
      "updatedAt": "2025-02-16T...",
      "directLink": { "token": "...", "enabled": false }
    }
  ],
  "totalPages": 1
}
```

Use `id` from each template for create-envelope.

---

### 3. Create template (upload PDF)

```
POST /api/template/create
```

**Headers:**
- `Authorization: Bearer <TOKEN_EXCHANGE_SECRET>` (or `X-API-Key`)
- `X-Documenso-API-Key: <apiKey>` (or pass `apiKey` in query)
- `Content-Type: multipart/form-data` (set automatically when sending FormData)

**Body (FormData):**
- `file` – **Required.** PDF file.
- `name` – Optional. Template name. Defaults to filename without `.pdf`.
- `expiresIn` – Optional. Authoring link expiry in minutes (default 60, max 10080).

**Success (200):**
```json
{
  "id": 1,
  "authoringLink": "https://sign.pinogy.com/embed/v1/authoring/template/edit/1?token=...",
  "expiresAt": "2025-02-16T...",
  "expiresIn": 3600
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | number | Template ID. Use for create-envelope and templates list. |
| `authoringLink` | string | Link to add recipients and fields in the embed authoring UI. Expires per `expiresIn`. |
| `expiresAt` | string | ISO 8601 timestamp when the authoring link expires. |
| `expiresIn` | number | Authoring link validity in seconds. |

Use `id` for create-envelope. Open `authoringLink` to add recipients and fields (link expires per `expiresIn`).

---

### 4. Create envelope from template

```
POST /api/template/{templateId}/create-envelope
```

**Headers:**
- `Authorization: Bearer <TOKEN_EXCHANGE_SECRET>` (or `X-API-Key`)
- `Content-Type: application/json`
- `X-Documenso-API-Key: <apiKey>` (or pass `apiKey` in query)

**Path:** `templateId` = numeric `id` from templates list (e.g. `1`)

**Body:**
```json
{
  "recipientEmail": "signer@example.com",
  "recipientName": "Jane Doe",
  "title": "Contract for Jane",
  "prefillFields": [
    { "id": 1, "type": "text", "value": "Prefilled value" },
    { "id": 2, "type": "number", "value": "42" },
    { "id": 3, "type": "checkbox", "value": ["option1"] },
    { "id": 4, "type": "radio", "value": "selected" },
    { "id": 5, "type": "dropdown", "value": "choice-a" }
  ]
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `recipientEmail` | Yes | string | Signer email |
| `recipientName` | No | string | Signer display name |
| `title` | No | string | Document title |
| `prefillFields` | No | array | See schema below |

**Prefill field types:** `text`, `number`, `radio`, `checkbox`, `dropdown`, `date`. Each needs `id` (field ID from template) and `type`. `value` depends on type:
- `text`, `number`, `radio`, `dropdown`, `date`: `value` is a string
- `checkbox`: `value` is an array of strings

**Success (200):**
```json
{
  "envelopeId": "envelope_xxxxxxxx",
  "signingUrl": "https://sign.pinogy.com/sign/abc123...",
  "signingToken": "abc123..."
}
```

- `signingUrl` – Open this URL for the recipient to sign (or send via email/SMS).
- `signingToken` – Use to build a custom URL: `https://sign.pinogy.com/sign/{signingToken}`

---

### 5. Document request (template authoring link)

```
POST /api/document-request
```

**Headers:** `Authorization: Bearer <TOKEN_EXCHANGE_SECRET>` (or `X-API-Key`)

**Body:**
```json
{
  "recipientEmail": "user@example.com",
  "apiKey": "api_xxxxxxxx",
  "expiresIn": 60
}
```

**Success (200):**
```json
{
  "link": "https://sign.pinogy.com/embed/v1/authoring/template/create?token=...",
  "expiresAt": "2025-02-16T...",
  "expiresIn": 3600,
  "recipientEmail": "user@example.com"
}
```

Open or share `link` so the recipient can upload a document and create a template.

---

## Error responses

All errors return JSON:

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

| Status | Code | Meaning |
|--------|------|---------|
| 400 | INVALID_REQUEST, INVALID_BODY, INVALID_JSON, LIMIT_EXCEEDED | Bad input or document limit reached |
| 401 | UNAUTHORIZED | Missing or invalid token-exchange secret |
| 404 | NOT_FOUND | Template not found or no access |
| 502 | DOCUMENSO_API_ERROR, etc. | Backend/Documenso error |

## Example: fetch flow

```javascript
const TOKEN_EXCHANGE_URL = 'https://sign-token.pinogy.com';
const TOKEN_EXCHANGE_SECRET = 'your-secret';

// 1. Exchange for API key
const exchangeRes = await fetch(`${TOKEN_EXCHANGE_URL}/api/exchange`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN_EXCHANGE_SECRET}`,
  },
  body: JSON.stringify({
    credentials: { host: 'https://api.pinogy.com', accessKey: '...', secretKey: '...' },
    slug: 'my-team',
    organisationId: 'clxx...',
  }),
});
const { apiKey } = await exchangeRes.json();

// 2. List templates
const templatesRes = await fetch(
  `${TOKEN_EXCHANGE_URL}/api/templates?apiKey=${encodeURIComponent(apiKey)}&page=1&perPage=10`,
  {
    headers: { 'Authorization': `Bearer ${TOKEN_EXCHANGE_SECRET}` },
  }
);
const { templates } = await templatesRes.json();

// 3. (Optional) Create template by uploading a PDF
const formData = new FormData();
formData.append('file', pdfFile);  // File object
formData.append('name', 'My Contract');
formData.append('expiresIn', '60');  // minutes
const createTemplateRes = await fetch(`${TOKEN_EXCHANGE_URL}/api/template/create`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN_EXCHANGE_SECRET}`,
    'X-Documenso-API-Key': apiKey,
  },
  body: formData,
});
const { id: newTemplateId, authoringLink } = await createTemplateRes.json();
// Open authoringLink to add recipients/fields. Use newTemplateId for create-envelope once configured.

// 4. Create envelope from template (use newTemplateId from step 3, or templates[0].id from step 2)
const templateId = newTemplateId ?? templates[0]?.id;
const createRes = await fetch(
  `${TOKEN_EXCHANGE_URL}/api/template/${templateId}/create-envelope`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN_EXCHANGE_SECRET}`,
      'X-Documenso-API-Key': apiKey,
    },
    body: JSON.stringify({
      recipientEmail: 'signer@example.com',
      recipientName: 'Jane Doe',
      title: 'Contract for Jane',
    }),
  }
);
const { signingUrl, envelopeId } = await createRes.json();
// Redirect user to signingUrl or send via email
```

## CORS

Token-exchange sends appropriate CORS headers. For browser requests, ensure the token-exchange origin is allowed by your app’s CORS policy if you proxy or restrict origins.
