import { z } from 'zod';

import { ZFieldMetaPrefillFieldsSchema } from '@documenso/lib/types/field-meta';
import { ZRecipientEmailSchema } from '@documenso/lib/types/recipient';

import type { TrpcRouteMeta } from '../trpc';

export const createEnvelopeMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/template/{templateEnvelopeId}/create-envelope',
    summary: 'Create envelope from template',
    description:
      'Creates a new document envelope from a template. Supports a single recipient and prefill fields. Automatically distributes the document to the recipient.',
    tags: ['Template'],
  },
};

export const ZCreateEnvelopeRequestSchema = z.object({
  templateEnvelopeId: z
    .string()
    .describe('The envelope ID of the template (e.g. envelope_xxxxxxxx).'),
  recipientEmail: ZRecipientEmailSchema.describe('Email address of the signing recipient.'),
  recipientName: z.string().max(255).optional().describe('Name of the signing recipient.'),
  title: z.string().min(1).max(255).optional().describe('Title for the created document.'),
  prefillFields: z
    .array(ZFieldMetaPrefillFieldsSchema)
    .optional()
    .describe('Prefill values for template fields (text, number, radio, checkbox, dropdown).'),
});

export const ZCreateEnvelopeResponseSchema = z.object({
  envelopeId: z.string().describe('The ID of the created envelope (e.g. envelope_xxxxxxxx).'),
  signingUrl: z.string().describe('URL for the recipient to sign the document.'),
  signingToken: z.string().describe('Token to build the signing URL (e.g. for custom URLs).'),
});

export type TCreateEnvelopeRequest = z.infer<typeof ZCreateEnvelopeRequestSchema>;
export type TCreateEnvelopeResponse = z.infer<typeof ZCreateEnvelopeResponseSchema>;
