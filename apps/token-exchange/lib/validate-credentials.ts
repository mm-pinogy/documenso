import type { POSCredentials } from './pos-client';
import { validatePOSCredentials } from './pos-client';

function isPOSCredentials(credentials: Record<string, unknown>): credentials is POSCredentials {
  return (
    typeof credentials.host === 'string' &&
    typeof credentials.accessKey === 'string' &&
    typeof credentials.secretKey === 'string'
  );
}

/**
 * Validate third-party (POS) credentials via GET /apps/any/test.
 * Uses accesskey, signature (HMAC-SHA256 of path+timestamp with secretKey), and timestamp.
 * Matches the Flutter NetworkRepository checkServer flow (no password required).
 */
export async function validateThirdPartyCredentials(
  credentials: Record<string, unknown>,
): Promise<boolean> {
  if (!credentials || !isPOSCredentials(credentials)) {
    return false;
  }

  const result = await validatePOSCredentials({
    host: credentials.host,
    accessKey: credentials.accessKey,
    secretKey: credentials.secretKey,
    appId: typeof credentials.appId === 'number' ? credentials.appId : undefined,
  });

  return result.valid;
}
