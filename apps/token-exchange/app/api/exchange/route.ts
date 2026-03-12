import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import { exchangeCredentials, exchangeTrusted } from '@/lib/exchange';

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.headers.get('X-API-Key');
}

/**
 * POST /api/exchange
 *
 * Token exchange: returns a Documenso API key for the given org + slug.
 * Authenticated by TOKEN_EXCHANGE_SECRET (Bearer or X-API-Key).
 *
 * Body (trusted flow): { slug: string, organisationId: string }
 * Body (credential flow): { credentials: { host?, accessKey?, secretKey? }, slug: string, organisationId: string }
 */
export async function POST(request: NextRequest) {
  const secret = process.env.TOKEN_EXCHANGE_SECRET;

  if (!secret) {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Token exchange is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const provided = getAuthHeader(request);
  if (!provided || provided !== secret) {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Invalid JSON body', code: 'INVALID_JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v);
  const data = isRecord(body) ? body : {};
  const credentials = data.credentials;
  const slug = typeof data.slug === 'string' ? data.slug : '';
  const organisationId = typeof data.organisationId === 'string' ? data.organisationId : '';

  if (!slug.trim() || !organisationId.trim()) {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'Missing or invalid fields: slug, organisationId',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  // Credential flow is only used when we have a real validator; otherwise use trusted flow.
  // Trusted flow: auth is TOKEN_EXCHANGE_SECRET; slug + organisationId are enough.
  const useCredentialFlow =
    process.env.TOKEN_EXCHANGE_VALIDATE_CREDENTIALS === 'true' && isRecord(credentials);

  const result = useCredentialFlow
    ? await exchangeCredentials({
        credentials,
        slug: slug.trim(),
        organisationId: organisationId.trim(),
      })
    : await exchangeTrusted({
        slug: slug.trim(),
        organisationId: organisationId.trim(),
      });

  if (!result.success) {
    const status =
      result.code === 'ORGANISATION_NOT_FOUND' || result.code === 'INVALID_SLUG'
        ? 404
        : result.code === 'TEAM_URL_TAKEN'
          ? 409
          : result.code === 'INVALID_CREDENTIALS'
            ? 401
            : 400;
    return cors(
      request,
      new Response(JSON.stringify({ error: result.error, code: result.code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  return cors(
    request,
    new Response(
      JSON.stringify({
        teamId: result.teamId,
        apiKey: result.apiKey,
        teamCreated: result.teamCreated,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
}

export function OPTIONS(request: NextRequest) {
  return cors(request, new Response(null, { status: 204 }));
}
