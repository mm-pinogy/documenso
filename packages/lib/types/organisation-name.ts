import { z } from 'zod';

/**
 * Organisation name validation schema.
 * Kept in a separate file to avoid circular dependencies with prisma-generated schemas.
 */
export const ZOrganisationNameSchema = z
  .string()
  .min(3, { message: 'Minimum 3 characters' })
  .max(50, { message: 'Maximum 50 characters' });
