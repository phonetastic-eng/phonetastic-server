import { z } from 'zod';
import { CompanyIdSchema } from './branded.js';

export const OfferingSchema = z.object({
  id: z.number().int().positive(),
  companyId: CompanyIdSchema,
  type: z.enum(['product', 'service']),
  name: z.string(),
  description: z.string().nullable(),
  priceAmount: z.string().nullable(),
  priceCurrency: z.string().nullable(),
  priceFrequency: z.enum(['one_time', 'hourly', 'daily', 'weekly', 'monthly', 'yearly']).nullable(),
});

export type Offering = z.infer<typeof OfferingSchema>;
