import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import { createEnvelope } from '@/lib/documenso-client';

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.headers.get('X-API-Key');
}

function getApiKey(req: NextRequest): string | null {
  const key = req.headers.get('X-Documenso-API-Key');
  if (key) return key;
  const url = new URL(req.url);
  return url.searchParams.get('apiKey');
}

/**
 * POST /api/template/[templateId]/create-envelope
 *
 * Creates a Documenso envelope (document) from a template and returns the signing URL.
 * Auth: Bearer TOKEN_EXCHANGE_SECRET. Documenso team identity: X-Documenso-API-Key or apiKey query.
 * Body: { recipientEmail, recipientName?, title?, prefillFields? }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ templateId: string }> },
) {
  const secret = process.env.TOKEN_EXCHANGE_SECRET;

  if (!secret) {
    return cors(
      request,
      new Response(
        JSON.stringify({ error: 'Token exchange is not configured', code: 'CONFIG_ERROR' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
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

  const apiKey = getApiKey(request);
  if (!apiKey?.trim()) {
    return cors(
      request,
      new Response(
        JSON.stringify({ error: 'Missing X-Documenso-API-Key or apiKey', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const { templateId } = await context.params;
  if (!templateId?.trim()) {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Missing templateId', code: 'INVALID_REQUEST' }), {
        status: 400,
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
  const recipientEmail = typeof data.recipientEmail === 'string' ? data.recipientEmail : '';
  if (!recipientEmail.trim()) {
    return cors(
      request,
      new Response(
        JSON.stringify({ error: 'Missing or invalid recipientEmail', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const recipientName = typeof data.recipientName === 'string' ? data.recipientName : 'Signer';
  const title = typeof data.title === 'string' ? data.title : undefined;
  const prefillFields = Array.isArray(data.prefillFields) ? data.prefillFields : undefined;

  try {
    const result = await createEnvelope(apiKey.trim(), templateId.trim(), {
      recipientEmail: recipientEmail.trim(),
      recipientName: recipientName.trim() || 'Signer',
      title: title?.trim() || undefined,
      prefillFields,
    });

    return cors(
      request,
      new Response(
        JSON.stringify({
          envelopeId: result.envelopeId,
          signingUrl: result.signingUrl,
          signingToken: result.signingToken,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNoSigner =
      message.includes('signer recipient') || message.includes('at least one signer');
    const isDocumenso = message.includes('Documenso') || isNoSigner;

    const code = isNoSigner
      ? 'TEMPLATE_NO_SIGNER'
      : isDocumenso
        ? 'DOCUMENSO_API_ERROR'
        : 'CREATE_ENVELOPE_FAILED';
    const status = isNoSigner ? 400 : 502;
    const hint = isNoSigner
      ? 'Open the template authoring_link (from your backend) and add at least one signer recipient, then retry create-envelope.'
      : undefined;

    return cors(
      request,
      new Response(
        JSON.stringify({
          error: message,
          code,
          ...(hint ? { hint } : {}),
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }
}

export function OPTIONS(request: NextRequest) {
  return cors(request, new Response(null, { status: 204 }));
}
