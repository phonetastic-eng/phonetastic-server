import { z } from 'zod';
import { UserIdSchema, CompanyIdSchema } from './branded.js';
import { UserCallSettingsSchema } from './user-call-settings.js';

export const UserSchema = z.object({
  id: UserIdSchema,
  companyId: CompanyIdSchema.nullable(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  jwtPrivateKey: z.string(),
  jwtPublicKey: z.string(),
  accessTokenNonce: z.number().int(),
  refreshTokenNonce: z.number().int(),
  callSettings: UserCallSettingsSchema,
});

export type User = z.infer<typeof UserSchema>;
