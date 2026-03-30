import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { skills } from './schema/index.js';
import { env } from '../config/env.js';

const SEED_SKILLS: { name: string; description: string; triggers?: string; allowedTools: string[] }[] = [
  {
    name: 'book_appointment',
    description:
      "Gathers the caller's personal information, checks the business calendar for availability that meets their needs, and books an appointment.",
    triggers: 'Use when the caller asks to book an appointment.',
    allowedTools: ['getAvailability', 'bookAppointment', 'todo', 'generateReply'],
  },
];

function buildConnectionUrl(): string {
  const { DATABASE_URL, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  if (DATABASE_URL) return DATABASE_URL;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
}

async function seedSkills() {
  const client = postgres(buildConnectionUrl(), { max: 1 });
  const db = drizzle(client);

  for (const skill of SEED_SKILLS) {
    await db
      .insert(skills)
      .values(skill)
      .onConflictDoUpdate({
        target: skills.name,
        set: { description: skill.description, triggers: skill.triggers ?? null, allowedTools: skill.allowedTools },
      });
  }

  console.log(`Seeded ${SEED_SKILLS.length} skill(s): ${SEED_SKILLS.map((s) => s.name).join(', ')}`);

  await client.end();
}

seedSkills().catch(console.error);
