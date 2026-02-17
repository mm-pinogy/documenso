import type { NextRequest } from 'next/server';

import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { getApiTokenByToken } from '@documenso/lib/server-only/public-api/get-api-token-by-token';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import type { TFieldMetaPrefillFieldsSchema } from '@documenso/lib/types/field-meta';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { formatSigningLink } from '@documenso/lib/utils/recipients';

export type CreateEnvelopeInput = {
  apiKey: string;
  templateEnvelopeId: string;
  recipientEmail: string;
  recipientName?: string;
  title?: string;
  prefillFields?: TFieldMetaPrefillFieldsSchema[];
  request: NextRequest;
};

export type CreateEnvelopeResult = {
  envelopeId: string;
  signingUrl: string;
  signingToken: string;
};

function parseTemplateIdInput(value: string): { type: 'templateId'; id: number } {
  const num = Number(value.trim());
  if (Number.isInteger(num) && num > 0) {
    return { type: 'templateId', id: num };
  }
  throw new AppError(AppErrorCode.INVALID_BODY, {
    message: 'Invalid template ID. Use the id from the templates list (e.g. 1).',
  });
}

export async function createEnvelopeFromTemplate(
  input: CreateEnvelopeInput,
): Promise<CreateEnvelopeResult> {
  const {
    apiKey,
    templateEnvelopeId,
    recipientEmail,
    recipientName,
    title,
    prefillFields,
    request,
  } = input;

  const apiToken = await getApiTokenByToken({ token: apiKey });

  if (apiToken.user.disabled) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'User is disabled',
    });
  }

  const user = apiToken.user;
  const team = apiToken.team;

  if (!team) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'API token must be associated with a team',
    });
  }

  const teamId = team.id;

  const limits = await getServerLimits({ userId: user.id, teamId });

  if (limits.remaining.documents <= 0) {
    throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
      message: 'You have reached your document limit.',
    });
  }

  const templateIdOption = parseTemplateIdInput(templateEnvelopeId);

  const template = await getEnvelopeById({
    id: templateIdOption,
    type: EnvelopeType.TEMPLATE,
    userId: user.id,
    teamId,
  });

  const signerRecipient = template.recipients.find((r) => r.role === 'SIGNER');

  if (!signerRecipient) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Template must have at least one signer recipient.',
    });
  }

  const requestMetadata = extractRequestMetadata(request);
  const metadata: ApiRequestMetadata = {
    requestMetadata,
    source: 'apiV2',
    auth: 'api',
    auditUser: {
      id: null,
      email: null,
      name: team.name ?? user.name ?? null,
    },
  };

  const createdEnvelope = await createDocumentFromTemplate({
    id: templateIdOption,
    userId: user.id,
    teamId,
    recipients: [
      {
        id: signerRecipient.id,
        email: recipientEmail,
        name: recipientName ?? '',
      },
    ],
    override: title ? { title } : undefined,
    prefillFields,
    requestMetadata: metadata,
  });

  await sendDocument({
    id: {
      type: 'envelopeId',
      id: createdEnvelope.id,
    },
    userId: user.id,
    teamId,
    sendEmail: false,
    requestMetadata: metadata,
  }).catch((err) => {
    console.error(err);
    throw new AppError('DOCUMENT_SEND_FAILED', {
      message: 'Failed to send document to recipient.',
    });
  });

  const recipient = createdEnvelope.recipients.find((r) => r.email === recipientEmail);

  if (!recipient) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Recipient not found after document creation.',
    });
  }

  return {
    envelopeId: createdEnvelope.id,
    signingUrl: formatSigningLink(recipient.token),
    signingToken: recipient.token,
  };
}
