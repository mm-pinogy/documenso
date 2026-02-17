import type { NextRequest } from 'next/server';

import cors from '@/lib/cors';
import {
  buildTemplateEditAuthoringLink,
  createPresignToken,
  createTemplate,
} from '@/lib/documenso-client';

function getAuthHeader(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return req.headers.get('X-API-Key');
}

/**
 * POST /api/template/create
 * Creates a template by uploading a PDF.
 *
 * Authentication: Bearer TOKEN_EXCHANGE_SECRET or X-API-Key
 * Documenso API key: X-Documenso-API-Key header or apiKey query param
 *
 * Request: multipart/form-data
 * - file: (required) PDF file
 * - name: (optional) Template name/title. Defaults to filename without .pdf
 * - expiresIn: (optional) Authoring link expiry in minutes (default 60, max 10080)
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'Invalid form data',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'Missing or invalid file. Send a PDF via multipart/form-data with key "file"',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  if (file.type !== 'application/pdf') {
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: 'File must be a PDF (application/pdf)',
          code: 'INVALID_REQUEST',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }

  const nameInput = formData.get('name');
  const name =
    typeof nameInput === 'string' && nameInput.trim()
      ? nameInput.trim()
      : file.name.endsWith('.pdf')
        ? file.name.slice(0, -4)
        : file.name;

  const payload = {
    title: name,
  };

  const expiresInInput = formData.get('expiresIn');
  const expiresIn =
    typeof expiresInInput === 'string' && expiresInInput.trim()
      ? Math.min(10080, Math.max(5, Number(expiresInInput) || 60))
      : 60;

  const documensoFormData = new FormData();
  documensoFormData.append('payload', JSON.stringify(payload));
  documensoFormData.append('file', file);

  try {
    const result = await createTemplate(apiKey, documensoFormData);

    const presign = await createPresignToken(apiKey, {
      expiresIn,
      scope: `templateId:${result.id}`,
    });
    const authoringLink = buildTemplateEditAuthoringLink(result.id, presign.token);

    return cors(
      request,
      new Response(
        JSON.stringify({
          id: result.id,
          authoringLink,
          expiresAt: presign.expiresAt,
          expiresIn: presign.expiresIn,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
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
