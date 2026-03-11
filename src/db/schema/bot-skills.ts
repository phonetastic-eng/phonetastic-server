import { pgTable, serial, boolean, integer } from 'drizzle-orm/pg-core';
import { skills } from './skills';
import { bots } from './bots';

export const botSkills = pgTable('bot_skills', {
  id: serial('id').primaryKey(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  skillId: integer('skill_id').notNull().references(() => skills.id),
  botId: integer('bot_id').notNull().references(() => bots.id),
});
