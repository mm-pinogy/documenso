import { z } from 'zod';

import OrganisationSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationSchema';

/**
 * Base organisation schema (re-export from Prisma model).
 * Used by get-organisation, get-admin-organisation, get-organisation-session.
 */
export const ZOrganisationSchema = OrganisationSchema;

/**
 * Base organisation schema for list responses (same as ZOrganisationSchema).
 * Used by get-organisations.
 */
export const ZOrganisationManySchema = OrganisationSchema;

/**
 * Shared organisation name validation schema.
 * Used by subscription metadata, create-organisation, and admin organisation routes.
 */
export const ZOrganisationNameSchema = z
  .string()
  .min(3, { message: 'Minimum 3 characters' })
  .max(50, { message: 'Maximum 50 characters' });

/**
 * Metadata stored in verification token for organisation SSO account link flow.
 */
export const ZOrganisationAccountLinkMetadataSchema = z.object({
  type: z.literal('organisation'),
  userId: z.number(),
  organisationId: z.string(),
  oauthConfig: z.object({
    providerAccountId: z.string(),
    accessToken: z.string().optional(),
    expiresAt: z.number().optional().nullable(),
    idToken: z.string().optional().nullable(),
  }),
});

export type TOrganisationAccountLinkMetadata = z.infer<
  typeof ZOrganisationAccountLinkMetadataSchema
>;
