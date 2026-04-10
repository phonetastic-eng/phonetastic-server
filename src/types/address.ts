import { z } from 'zod';
import { CompanyIdSchema } from './branded.js';

export const AddressSchema = z.object({
  id: z.number().int().positive(),
  companyId: CompanyIdSchema,
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  label: z.string().nullable(),
});

export type Address = z.infer<typeof AddressSchema>;
