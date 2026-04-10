import { z } from 'zod';
import { VoiceIdSchema } from './branded.js';

export const VoiceSchema = z.object({
  id: VoiceIdSchema,
  supportedLanguages: z.array(z.string()),
  name: z.string(),
  snippet: z.instanceof(Buffer),
  snippetMimeType: z.string(),
  externalId: z.string(),
  provider: z.string(),
});

export type Voice = z.infer<typeof VoiceSchema>;
