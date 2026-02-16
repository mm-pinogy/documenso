import { EnvelopeType } from '@prisma/client';

import { getServerLimits } from '@documenso/ee/server-only/limits/server';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { sendDocument } from '@documenso/lib/server-only/document/send-document';
import { getEnvelopeById } from '@documenso/lib/server-only/envelope/get-envelope-by-id';
import { createDocumentFromTemplate } from '@documenso/lib/server-only/template/create-document-from-template';
import { formatSigningLink } from '@documenso/lib/utils/recipients';

import { authenticatedProcedure } from '../trpc';
import {
  ZCreateEnvelopeRequestSchema,
  ZCreateEnvelopeResponseSchema,
  createEnvelopeMeta,
} from './create-envelope.types';

function parseTemplateIdInput(value: string): { type: 'templateId'; id: number } {
  const num = Number(value.trim());
  if (Number.isInteger(num) && num > 0) {
    return { type: 'templateId', id: num };
  }
  throw new AppError(AppErrorCode.INVALID_BODY, {
    message: 'Invalid template ID. Use the id from the templates list (e.g. 1).',
  });
}

export const createEnvelopeRoute = authenticatedProcedure
  .meta(createEnvelopeMeta)
  .input(ZCreateEnvelopeRequestSchema)
  .output(ZCreateEnvelopeResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;
    const { templateEnvelopeId, recipientEmail, recipientName, title, prefillFields } = input;

    ctx.logger.info({
      input: {
        templateEnvelopeId,
      },
    });

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
      requestMetadata: ctx.metadata,
    });

    await sendDocument({
      id: {
        type: 'envelopeId',
        id: createdEnvelope.id,
      },
      userId: user.id,
      teamId,
      requestMetadata: ctx.metadata,
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
  });
