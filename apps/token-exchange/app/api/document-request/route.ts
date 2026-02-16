import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import { buildTemplateAuthoringLink, createPresignToken } from '@/lib/documenso-client';
import { exchangeCredentials } from '@/lib/exchange';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBody(body: unknown): {
  apiKey?: string;
  recipientEmail?: string;
  expiresIn?: number;
  credentials?: Record<string, unknown>;
  slug?: string;
  organisationId?: string;
} | null {
  if (!isRecord(body)) {
    return null;
  }

  const { apiKey, recipientEmail, expiresIn, credentials, slug, organisationId } = body;

  const result: {
    apiKey?: string;
    recipientEmail?: string;
    expiresIn?: number;
    credentials?: Record<string, unknown>;
    slug?: string;
    organisationId?: string;
  } = {};

  if (typeof recipientEmail === 'string' && recipientEmail.trim()) {
    const email = recipientEmail.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      result.recipientEmail = email;
    }
  }

  if (typeof apiKey === 'string' && apiKey.trim()) {
    result.apiKey = apiKey.trim();
  }

  if (typeof expiresIn === 'number' && expiresIn >= 5 && expiresIn <= 10080) {
    result.expiresIn = expiresIn;
  }

  if (isRecord(credentials) && typeof slug === 'string' && typeof organisationId === 'string') {
    result.credentials = credentials;
    result.slug = slug.trim();
    result.organisationId = organisationId.trim();
  }

  return result;
}

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.headers.get('X-API-Key');
}

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

  const parsed = parseBody(body);
  if (!parsed) {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'Provide either apiKey or (credentials, slug, organisationId)',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  let apiKey: string;

  if (parsed.apiKey) {
    apiKey = parsed.apiKey;
  } else if (parsed.credentials && parsed.slug && parsed.organisationId) {
    const exchangeResult = await exchangeCredentials({
      credentials: parsed.credentials,
      slug: parsed.slug,
      organisationId: parsed.organisationId,
    });
    if (!exchangeResult.success) {
      const status =
        exchangeResult.code === 'INVALID_CREDENTIALS'
          ? 401
          : exchangeResult.code === 'ORGANISATION_NOT_FOUND' ||
              exchangeResult.code === 'INVALID_SLUG'
            ? 404
            : exchangeResult.code === 'TEAM_URL_TAKEN'
              ? 409
              : 400;
      return cors(
        request,
        new Response(JSON.stringify({ error: exchangeResult.error, code: exchangeResult.code }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    }
    apiKey = exchangeResult.apiKey;
  } else {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'Provide either apiKey or (credentials, slug, organisationId)',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  try {
    const presign = await createPresignToken(apiKey, {
      expiresIn: parsed.expiresIn ?? 60,
    });
    const link = buildTemplateAuthoringLink(presign.token);

    return cors(
      request,
      new Response(
        JSON.stringify({
          link,
          expiresAt: presign.expiresAt,
          expiresIn: presign.expiresIn,
          ...(parsed.recipientEmail && { recipientEmail: parsed.recipientEmail }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: message,
          code: 'DOCUMENSO_API_ERROR',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return cors(request, new Response(null, { status: 204 }));
}
