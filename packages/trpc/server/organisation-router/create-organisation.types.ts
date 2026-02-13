import { z } from 'zod';

import { ZOrganisationNameSchema } from '@documenso/lib/types/organisation-name';

export { ZOrganisationNameSchema };

export const ZCreateOrganisationRequestSchema = z.object({
  name: ZOrganisationNameSchema,
  priceId: z.string().optional(),
});

export const ZCreateOrganisationResponseSchema = z.union([
  z.object({
    paymentRequired: z.literal(false),
  }),
  z.object({
    paymentRequired: z.literal(true),
    checkoutUrl: z.string(),
  }),
]);

export type TCreateOrganisationResponse = z.infer<typeof ZCreateOrganisationResponseSchema>;
