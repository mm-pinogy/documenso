import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import { createEnvelopeFromTemplate } from '@/lib/server/create-envelope';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.headers.get('X-API-Key');
}

/**
 * POST /api/template/{templateEnvelopeId}/create-envelope
 * Creates a document envelope from a template and distributes it to the recipient.
 *
 * Authentication: Bearer TOKEN_EXCHANGE_SECRET or X-API-Key
 * Documenso API key: X-Documenso-API-Key header or apiKey query param
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateEnvelopeId: string }> },
) {
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

  const apiKey =
    request.headers.get('X-Documenso-API-Key') ?? new URL(request.url).searchParams.get('apiKey');
  if (!apiKey) {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error:
            'Missing Documenso API key. Pass via X-Documenso-API-Key header or apiKey query param',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const { templateEnvelopeId } = await params;

  if (!templateEnvelopeId) {
    return cors(
      request,
      new Response(
        JSON.stringify({ error: 'Missing templateEnvelopeId in path', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
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

  const recipientEmail =
    typeof body === 'object' && body !== null && 'recipientEmail' in body
      ? (body as { recipientEmail?: unknown }).recipientEmail
      : undefined;

  if (typeof recipientEmail !== 'string' || !recipientEmail.trim()) {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'recipientEmail is required and must be a non-empty string',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const recipientName =
    typeof body === 'object' && body !== null && 'recipientName' in body
      ? (body as { recipientName?: unknown }).recipientName
      : undefined;

  const title =
    typeof body === 'object' && body !== null && 'title' in body
      ? (body as { title?: unknown }).title
      : undefined;

  const prefillFields =
    typeof body === 'object' && body !== null && 'prefillFields' in body
      ? (body as { prefillFields?: unknown }).prefillFields
      : undefined;

  try {
    const result = await createEnvelopeFromTemplate({
      apiKey,
      templateEnvelopeId,
      recipientEmail: recipientEmail.trim(),
      recipientName: typeof recipientName === 'string' ? recipientName : undefined,
      title: typeof title === 'string' ? title : undefined,
      prefillFields: Array.isArray(prefillFields) ? prefillFields : undefined,
      request,
    });

    return cors(
      request,
      new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch (err) {
    const error = AppError.parseError(err);
    const message = error.message;
    const status =
      error.code === AppErrorCode.UNAUTHORIZED
        ? 401
        : error.code === AppErrorCode.INVALID_BODY ||
            error.code === AppErrorCode.INVALID_REQUEST ||
            error.code === AppErrorCode.LIMIT_EXCEEDED
          ? 400
          : error.code === AppErrorCode.NOT_FOUND
            ? 404
            : 502;
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: message,
          code: error.code,
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return cors(request, new Response(null, { status: 204 }));
}
