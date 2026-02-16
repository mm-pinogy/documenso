import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import { getTemplates } from '@/lib/documenso-client';

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.headers.get('X-API-Key');
}

/**
 * GET /api/templates
 * Lists templates for the team associated with the provided API key.
 * The apiKey must be passed in Authorization header (Bearer) or X-API-Key.
 *
 * Query params: page (default 1), perPage (default 10)
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const apiKey = request.headers.get('X-Documenso-API-Key') ?? searchParams.get('apiKey');
  if (!apiKey) {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error:
            'Missing Documenso API key. Pass via X-Documenso-API-Key header or apiKey query param (from /api/exchange)',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const perPage = Math.min(100, Math.max(1, Number(searchParams.get('perPage')) || 10));

  try {
    const result = await getTemplates(apiKey, { page, perPage });
    return cors(
      request,
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
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
