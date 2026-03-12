import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import { createDocumentFromPdf, distributeEnvelope } from '@/lib/documenso-client';

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
 * POST /api/document/create
 *
 * Create a signable document from a PDF in one call. No template or authoring step.
 * The PDF should contain Documenso placeholder patterns (e.g. {{signature, r1}}, {{date, r1}}).
 * r1 maps to the single signer you pass; placeholders are auto-detected and fields are placed.
 *
 * Auth: Bearer TOKEN_EXCHANGE_SECRET. X-Documenso-API-Key or apiKey query (required).
 * Body (FormData): file (required), recipientEmail (required), recipientName?, title?
 *
 * Success: { envelopeId, signingUrl, signingToken }
 */
export async function POST(request: NextRequest) {
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
        JSON.stringify({
          error: 'Missing X-Documenso-API-Key or apiKey query param',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Invalid form data', code: 'INVALID_BODY' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return cors(
      request,
      new Response(JSON.stringify({ error: 'Missing or invalid file', code: 'INVALID_REQUEST' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  const recipientEmailRaw = formData.get('recipientEmail');
  const recipientEmail =
    typeof recipientEmailRaw === 'string' && recipientEmailRaw.trim()
      ? recipientEmailRaw.trim()
      : '';
  if (!recipientEmail) {
    return cors(
      request,
      new Response(
        JSON.stringify({ error: 'Missing or invalid recipientEmail', code: 'INVALID_REQUEST' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const recipientNameRaw = formData.get('recipientName');
  const recipientName =
    typeof recipientNameRaw === 'string' && recipientNameRaw.trim()
      ? recipientNameRaw.trim()
      : 'Signer';
  const titleRaw = formData.get('title');
  const title =
    typeof titleRaw === 'string' && titleRaw.trim()
      ? titleRaw.trim()
      : file.name.replace(/\.pdf$/i, '') || 'Document';

  const payload = JSON.stringify({
    type: 'DOCUMENT',
    title,
    recipients: [
      {
        email: recipientEmail,
        name: recipientName,
        role: 'SIGNER',
      },
    ],
  });

  const documensoFormData = new FormData();
  documensoFormData.append('payload', payload);
  documensoFormData.append('files', file, file.name);

  try {
    const { id: envelopeId } = await createDocumentFromPdf(apiKey.trim(), documensoFormData);
    const distributed = await distributeEnvelope(apiKey.trim(), envelopeId);

    const signer = distributed.recipients.find((r) => String(r.role).toUpperCase() === 'SIGNER');
    if (!signer?.signingUrl) {
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: 'Distribute did not return a signer or signing URL',
            code: 'DOCUMENSO_API_ERROR',
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    }

    return cors(
      request,
      new Response(
        JSON.stringify({
          envelopeId,
          signingUrl: signer.signingUrl,
          signingToken: signer.token ?? '',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
