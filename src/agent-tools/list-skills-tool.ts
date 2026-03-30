import { llm } from '@livekit/agents';
import { container } from '../config/container.js';
import type { SkillRepository } from '../repositories/skill-repository.js';
import type { AppointmentBookingSettingsRepository } from '../repositories/appointment-booking-settings-repository.js';

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
      const skillRepo = container.resolve<SkillRepository>('SkillRepository');
      const settingsRepo = container.resolve<AppointmentBookingSettingsRepository>('AppointmentBookingSettingsRepository');

      const allSkills = await skillRepo.findAll();
      const settings = await settingsRepo.findByBotId(botId);

      const available = allSkills.filter((skill) => {
        if (skill.name === 'book_appointment') {
          return settings?.isEnabled === true;
        }
        return true;
      });

      return {
        skills: available.map((s) => ({
          name: s.name,
          description: s.description,
        })),
      };
    },
  });
}
