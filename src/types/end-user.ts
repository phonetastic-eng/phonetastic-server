import { z } from 'zod';
import { EndUserIdSchema, CompanyIdSchema } from './branded.js';

export const EndUserSchema = z.object({
  id: EndUserIdSchema,
  companyId: CompanyIdSchema,
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
});

export type EndUser = z.infer<typeof EndUserSchema>;
