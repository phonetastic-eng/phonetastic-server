import { llm } from '@livekit/agents';
import { container } from '../config/container.js';
import type { SkillRepository } from '../repositories/skill-repository.js';
import type { BotRepository } from '../repositories/bot-repository.js';
import { BOOK_APPOINTMENT_SKILL } from './skill-names.js';

/**
 * Creates a tool that lists available skills for the bot.
 *
 * Returns name and description for each skill. Steerable skills
 * (e.g., book_appointment) are filtered by their settings' is_enabled flag.
 *
 * @precondition The skills table contains at least one skill.
 * @postcondition An array of available skill summaries is returned.
 * @param botId - The bot whose settings determine skill availability.
 * @returns An LLM tool the agent can invoke to discover skills.
 */
export function createListSkillsTool(botId: number) {
  return llm.tool({
    description:
      'Lists all skills available to you. Call this at the start of every conversation ' +
      'to learn what capabilities you have.',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: async () => {
      try {
        const skillRepo = container.resolve<SkillRepository>('SkillRepository');
        const botRepo = container.resolve<BotRepository>('BotRepository');

        const [allSkills, bot] = await Promise.all([
          skillRepo.findAll({ limit: 1000 }),
          botRepo.findById(botId),
        ]);

        const appt = bot?.appointmentSettings;
        const available = allSkills.filter((skill) => {
          if (skill.name === BOOK_APPOINTMENT_SKILL) return appt?.isEnabled === true;
          return true;
        });

        return {
          skills: available.map((s) => {
            const triggers = s.name === BOOK_APPOINTMENT_SKILL
              ? (appt?.triggers ?? s.triggers)
              : s.triggers;
            return { name: s.name, description: s.description, triggers: triggers ?? null };
          }),
        };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  });
}
