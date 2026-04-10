import { z } from 'zod';
import { UserIdSchema, CompanyIdSchema } from './branded.js';

export const CalendarSchema = z.object({
  id: z.number().int().positive(),
  userId: UserIdSchema,
  companyId: CompanyIdSchema,
  provider: z.literal('google'),
  externalId: z.string().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  email: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenExpiresAt: z.date(),
  createdAt: z.date(),
});

export type Calendar = z.infer<typeof CalendarSchema>;
