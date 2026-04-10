import { z } from 'zod';
import { CompanyIdSchema } from './branded.js';

export const OperationHoursSchema = z.object({
  id: z.number().int().positive(),
  companyId: CompanyIdSchema,
  dayOfWeek: z.number().int(),
  openTime: z.string(),
  closeTime: z.string(),
});

export type OperationHours = z.infer<typeof OperationHoursSchema>;
