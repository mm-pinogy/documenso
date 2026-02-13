import { createHmac } from 'node:crypto';

export type POSCredentials = {
  host: string;
  accessKey: string;
  secretKey: string;
  appId?: number;
};

function normalizeHost(host: string): string {
  const trimmed = host.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function timestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function signature(path: string, timestampValue: string, secretKey: string): string {
  return createHmac('sha256', secretKey)
    .update(path + timestampValue)
    .digest('base64');
}

/**
 * Validate credentials by calling GET /apps/any/test.
 * Uses accesskey, signature (HMAC-SHA256 of path+timestamp with secretKey), and timestamp.
 * Matches the Flutter NetworkRepository checkServer flow (no password required).
 */
export async function validatePOSCredentials(
  credentials: POSCredentials,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const { host, accessKey, secretKey } = credentials;

  if (!host || !accessKey || !secretKey) {
    return { valid: false, error: 'Missing host, accessKey, or secretKey' };
  }

  const baseUrl = normalizeHost(host);
  const path = '/apps/any/test';
  const timestampValue = timestamp();
  const sig = signature(path, timestampValue, secretKey);

  const params = new URLSearchParams({
    accesskey: accessKey,
    timestamp: timestampValue,
    signature: sig,
  });

  const testUrl = `${baseUrl.replace(/\/$/, '')}${path}?${params.toString()}`;

  let response: Response;

  try {
    response = await fetch(testUrl, {
      method: 'GET',
      headers: { Accept: '*/*' },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error';
    return { valid: false, error: `POS API request failed: ${message}` };
  }

  if (!response.ok) {
    const body = await response.text();
    return {
      valid: false,
      error: `POS test failed (${response.status}): ${body.slice(0, 200)}`,
    };
  }

  let json: Record<string, unknown>;

  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    return { valid: false, error: 'POS API returned invalid JSON' };
  }

  if (json.error) {
    return { valid: false, error: `POS API error: ${String(json.error)}` };
  }

  return { valid: true };
}
