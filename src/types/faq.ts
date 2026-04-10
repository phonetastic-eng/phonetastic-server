import { z } from 'zod';
import { CompanyIdSchema } from './branded.js';

export const FaqSchema = z.object({
  id: z.number().int().positive(),
  companyId: CompanyIdSchema,
  question: z.string(),
  answer: z.string(),
  embedding: z.array(z.number()).nullable(),
});

export type Faq = z.infer<typeof FaqSchema>;
