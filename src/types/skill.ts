import { z } from 'zod';
import { SkillIdSchema } from './branded.js';

export const SkillSchema = z.object({
  id: SkillIdSchema,
  name: z.string(),
  description: z.string(),
  triggers: z.string().nullable(),
  allowedTools: z.array(z.string()),
});

export type Skill = z.infer<typeof SkillSchema>;
