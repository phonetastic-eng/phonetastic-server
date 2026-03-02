import { Factory } from 'fishery';
import { getTestDb } from '../helpers/test-app.js';
import { voices } from '../../src/db/schema/voices.js';
import { companies } from '../../src/db/schema/companies.js';
import { skills } from '../../src/db/schema/skills.js';

type VoiceRow = typeof voices.$inferSelect;
type CompanyRow = typeof companies.$inferSelect;
type SkillRow = typeof skills.$inferSelect;

export const voiceFactory = Factory.define<VoiceRow>(({ sequence }) => ({
  id: sequence,
  name: `Voice ${sequence}`,
  supportedLanguages: ['en'],
  snippet: '',
  snippetMimeType: 'audio/mp3',
})).onCreate(async (voice) => {
  const [row] = await getTestDb().insert(voices).values({
    name: voice.name,
    supportedLanguages: voice.supportedLanguages,
    snippet: voice.snippet,
    snippetMimeType: voice.snippetMimeType,
  }).returning();
  return row;
});

export const companyFactory = Factory.define<CompanyRow>(({ sequence }) => ({
  id: sequence,
  name: `Test Company ${sequence}`,
  businessType: null,
  website: null,
  email: null,
})).onCreate(async (company) => {
  const [row] = await getTestDb().insert(companies).values({
    name: company.name,
    businessType: company.businessType ?? undefined,
    website: company.website ?? undefined,
    email: company.email ?? undefined,
  }).returning();
  return row;
});

export const skillFactory = Factory.define<SkillRow>(({ sequence }) => ({
  id: sequence,
  name: `Skill ${sequence}`,
  settingsSchema: {},
  paramsSchema: {},
})).onCreate(async (skill) => {
  const [row] = await getTestDb().insert(skills).values({
    name: skill.name,
    settingsSchema: skill.settingsSchema,
    paramsSchema: skill.paramsSchema,
  }).returning();
  return row;
});
