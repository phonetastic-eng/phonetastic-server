import { z } from 'zod';
import { ContactIdSchema, UserIdSchema, CompanyIdSchema } from './branded.js';

export const ContactSchema = z.object({
  id: ContactIdSchema,
  userId: UserIdSchema,
  companyId: CompanyIdSchema,
  deviceId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.date(),
});

export type Contact = z.infer<typeof ContactSchema>;
