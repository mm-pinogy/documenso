import { createHmac } from 'node:crypto';

export type POSCredentials = {
  host: string;
  accessKey: string;
  secretKey: string;
  password: string;
  appId?: number;
};

const DEFAULT_APP_ID = 4; // CASH_REGISTER from AppId

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
 * Validate credentials by calling POS sign_in.
 * Creates a session; optionally sign_out to clean up.
 */
export async function validatePOSCredentials(
  credentials: POSCredentials,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const { host, accessKey, secretKey, password, appId = DEFAULT_APP_ID } = credentials;

  if (!host || !accessKey || !secretKey || !password) {
    return { valid: false, error: 'Missing host, accessKey, secretKey, or password' };
  }

  const baseUrl = normalizeHost(host);
  const path = '/apps/any/sessions';
  const timestampValue = timestamp();
  const sig = signature(path, timestampValue, secretKey);

  const formBody = new URLSearchParams({
    accesskey: accessKey,
    timestamp: timestampValue,
    signature: sig,
    password,
    app_id: String(appId),
  });

  const signInUrl = baseUrl.replace(/\/$/, '') + path;

  let response: Response;

  try {
    response = await fetch(signInUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: '*/*',
      },
      body: formBody.toString(),
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
      error: `POS sign_in failed (${response.status}): ${body.slice(0, 200)}`,
    };
  }

  let json: { token?: string; id?: string | number };

  try {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    json = (await response.json()) as { token?: string; id?: string | number };
  } catch {
    return { valid: false, error: 'POS API returned invalid JSON' };
  }

  if (!json.token) {
    return { valid: false, error: 'POS sign_in did not return a token' };
  }

  const sessionId = json.id;

  if (typeof sessionId !== 'undefined' && sessionId !== null) {
    const signOutPath = `/apps/any/sessions/${sessionId}`;
    const signOutTimestamp = timestamp();
    const signOutSig = signature(signOutPath, signOutTimestamp, secretKey);

    const signOutParams = new URLSearchParams({
      accesskey: accessKey,
      timestamp: signOutTimestamp,
      signature: signOutSig,
      session: json.token,
    });

    const signOutUrl = `${baseUrl.replace(/\/$/, '')}${signOutPath}?${signOutParams.toString()}`;

    try {
      await fetch(signOutUrl, {
        method: 'DELETE',
        headers: { Accept: '*/*' },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Ignore sign_out errors; validation already succeeded
    }
  }

  return { valid: true };
}
