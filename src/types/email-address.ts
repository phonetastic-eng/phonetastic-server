import { z } from 'zod';
import { CompanyIdSchema } from './branded.js';

export const EmailAddressSchema = z.object({
  id: z.number().int().positive(),
  companyId: CompanyIdSchema,
  address: z.string(),
  createdAt: z.date(),
});

export type EmailAddress = z.infer<typeof EmailAddressSchema>;
