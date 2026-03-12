/**
 * Client for calling the Documenso main app API.
 * Used for create-presign-token and get-templates.
 */

const getDocumensoUrl = (): string => {
  const url = process.env.DOCUMENSO_URL ?? process.env.NEXT_PUBLIC_DOCUMENSO_URL;
  if (!url) {
    throw new Error('DOCUMENSO_URL or NEXT_PUBLIC_DOCUMENSO_URL is not set');
  }
  return url.replace(/\/$/, '');
};

export type CreatePresignTokenResponse = {
  token: string;
  expiresAt: string;
  expiresIn: number;
};

export async function createPresignToken(
  apiKey: string,
  options?: { expiresIn?: number; scope?: string },
): Promise<CreatePresignTokenResponse> {
  const baseUrl = getDocumensoUrl();
  const res = await fetch(`${baseUrl}/api/v2-beta/embedding/create-presign-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expiresIn: options?.expiresIn ?? 60,
      scope: options?.scope,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Documenso create-presign-token failed (${res.status}): ${body.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<CreatePresignTokenResponse>;
}

export type TemplateListItem = {
  id: number;
  externalId: string | null;
  type: string;
  title: string;
  userId: number;
  teamId: number | null;
  createdAt: string;
  updatedAt: string;
  directLink?: { token: string; enabled: boolean } | null;
};

export type GetTemplatesResponse = {
  templates: TemplateListItem[];
  totalPages: number;
};

export async function getTemplates(
  apiKey: string,
  options?: { page?: number; perPage?: number },
): Promise<GetTemplatesResponse> {
  const baseUrl = getDocumensoUrl();
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.perPage) params.set('perPage', String(options.perPage));

  const url = `${baseUrl}/api/v1/templates${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Documenso get-templates failed (${res.status}): ${body.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<GetTemplatesResponse>;
}

/**
 * Encodes embed params for the authoring URL hash.
 * The authoring pages expect: base64(encodeURIComponent(JSON.stringify(params)))
 */
function encodeEmbedAuthoringHash(params: Record<string, unknown> = {}): string {
  const json = JSON.stringify(params);
  return Buffer.from(encodeURIComponent(json), 'utf-8').toString('base64');
}

export function buildTemplateAuthoringLink(presignToken: string): string {
  const baseUrl = getDocumensoUrl();
  const hash = encodeEmbedAuthoringHash({});
  return `${baseUrl}/embed/v1/authoring/template/create?token=${encodeURIComponent(presignToken)}#${hash}`;
}

export function buildTemplateEditAuthoringLink(id: number, presignToken: string): string {
  const baseUrl = getDocumensoUrl();
  const hash = encodeEmbedAuthoringHash({});
  return `${baseUrl}/embed/v1/authoring/template/edit/${id}?token=${encodeURIComponent(presignToken)}#${hash}`;
}

export type TemplateRecipient = {
  id: number;
  role: string;
  email?: string;
  name?: string | null;
};

export type GetTemplateByIdResponse = {
  id: number;
  envelopeId: string;
  recipients: TemplateRecipient[];
  [key: string]: unknown;
};

/**
 * Fetch a template by ID so we can use its recipient slots (e.g. first SIGNER) when creating a document.
 */
export async function getTemplate(
  apiKey: string,
  templateId: number,
): Promise<GetTemplateByIdResponse> {
  const baseUrl = getDocumensoUrl();
  const url = `${baseUrl}/api/v2-beta/template/${templateId}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Documenso get-template failed (${res.status}): ${text.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<GetTemplateByIdResponse>;
}

export type CreateEnvelopeRequest = {
  recipientEmail: string;
  recipientName?: string;
  title?: string;
  prefillFields?: Array<{
    id: number;
    type: string;
    value?: string | string[];
    [key: string]: unknown;
  }>;
};

export type CreateEnvelopeResponse = {
  envelopeId: string;
  signingUrl: string;
  signingToken: string;
};

export type CreateTemplateResponse = {
  envelopeId: string;
  id: number;
};

export async function createTemplate(
  apiKey: string,
  formData: FormData,
): Promise<CreateTemplateResponse> {
  const baseUrl = getDocumensoUrl();
  const url = `${baseUrl}/api/v2-beta/template/create`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Documenso create-template failed (${res.status}): ${text.slice(0, 300)}`);
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return res.json() as Promise<CreateTemplateResponse>;
}

/**
 * Create an envelope (document) from a template by using the Documenso "template/use" API.
 * Fetches the template and includes all recipients (signers, approvers, viewers, CC) mapped by id.
 * The first SIGNER slot is filled with the requested recipient email/name; other recipients keep their template values.
 */
export async function createEnvelope(
  apiKey: string,
  templateEnvelopeId: string,
  body: CreateEnvelopeRequest,
): Promise<CreateEnvelopeResponse> {
  const baseUrl = getDocumensoUrl();
  const templateId = Number(templateEnvelopeId);

  if (!Number.isInteger(templateId) || templateId < 1) {
    throw new Error(`Invalid template ID: ${templateEnvelopeId}`);
  }

  const template = await getTemplate(apiKey, templateId);
  const recipients = template.recipients ?? [];
  const firstSigner = recipients.find((r) => String(r.role).toUpperCase() === 'SIGNER');

  if (!firstSigner) {
    throw new Error(
      'Template must have at least one signer recipient. Add a signer in the template editor (authoring link) and try again.',
    );
  }

  const useBody = {
    templateId,
    recipients: recipients.map((r) => {
      const isFirstSigner = r.id === firstSigner.id;
      return {
        id: r.id,
        email: isFirstSigner ? body.recipientEmail : (r.email ?? ''),
        name: isFirstSigner ? (body.recipientName ?? '') : (r.name ?? ''),
      };
    }),
    prefillFields: body.prefillFields,
    distributeDocument: true,
  };

  const res = await fetch(`${baseUrl}/api/v2-beta/template/use`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(useBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Documenso create-envelope failed (${res.status}): ${text.slice(0, 300)}`);
  }

  type UseResponse = {
    envelopeId?: string;
    id?: number;
    recipients?: Array<{ token: string; role?: string }>;
  };

  const doc = (await res.json()) as UseResponse;

  const signerRecipient = doc.recipients?.find(
    (rec) => String(rec.role).toUpperCase() === 'SIGNER',
  );
  if (!signerRecipient?.token) {
    throw new Error('Documenso template/use did not return a signing token');
  }

  const envelopeId = doc.envelopeId ?? (doc.id != null ? String(doc.id) : '');

  return {
    envelopeId,
    signingUrl: `${baseUrl}/sign/${signerRecipient.token}`,
    signingToken: signerRecipient.token,
  };
}
