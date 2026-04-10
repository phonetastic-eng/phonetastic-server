import { z } from 'zod';
import { CompanyIdSchema } from './branded.js';

export const CompanySchema = z.object({
  id: CompanyIdSchema,
  name: z.string(),
  businessType: z.string().nullable(),
  website: z.string().nullable(),
  emails: z.array(z.string()).nullable(),
});

export type Company = z.infer<typeof CompanySchema>;
