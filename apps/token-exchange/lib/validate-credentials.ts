import type { POSCredentials } from './pos-client';
import { validatePOSCredentials } from './pos-client';

function isPOSCredentials(credentials: Record<string, unknown>): credentials is POSCredentials {
  return (
    typeof credentials.host === 'string' &&
    typeof credentials.accessKey === 'string' &&
    typeof credentials.secretKey === 'string' &&
    typeof credentials.password === 'string'
  );
}

/**
 * Validate third-party (POS) credentials via sign_in.
 * Calls POST /apps/any/sessions; on success, calls DELETE to sign out and clean up.
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
    password: credentials.password,
    appId: typeof credentials.appId === 'number' ? credentials.appId : undefined,
  });

  return result.valid;
}
