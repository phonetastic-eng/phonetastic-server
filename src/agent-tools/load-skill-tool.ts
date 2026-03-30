import { llm } from '@livekit/agents';
import { Eta } from 'eta';
import { container } from '../config/container.js';
import type { SkillRepository } from '../repositories/skill-repository.js';
import type { AppointmentBookingSettingsRepository } from '../repositories/appointment-booking-settings-repository.js';
import { loadSkillTemplate } from '../agent/skill-template-loader.js';
import { BOOK_APPOINTMENT_SKILL } from './skill-names.js';

const eta = new Eta();

/**
 * Creates a tool that loads a skill's instructions for the agent.
 *
 * Reads the skill template from file, interpolates customer instructions
 * from the settings table when present, and returns the result.
 * Steerable skills are checked for is_enabled before loading.
 *
 * @precondition The skill must exist in the skills table.
 * @postcondition The skill instructions and allowed tools are returned.
 * @param botId - The bot whose settings provide customer instructions.
 * @returns An LLM tool the agent can invoke to load a skill.
 */
export function createLoadSkillTool(botId: number) {
  return llm.tool({
    description:
      'Loads a skill by name, returning its instructions and allowed tools. ' +
      'Use this when you need to activate a specific capability.',
    parameters: {
      type: 'object',
      properties: {
        skill_name: {
          type: 'string',
          description: 'The name of the skill to load.',
        },
      },
      required: ['skill_name'],
    },
    execute: async (params: { skill_name: string }) => {
      try {
        const skillRepo = container.resolve<SkillRepository>('SkillRepository');
        const skill = await skillRepo.findByName(params.skill_name);

        if (!skill) {
          return { loaded: false, message: `Skill "${params.skill_name}" not found.` };
        }

        const settings = await resolveSettings(botId, skill.name);
        if (settings === 'disabled') {
          return { loaded: false, message: `Skill "${params.skill_name}" is not enabled.` };
        }

        const template = await loadSkillTemplate(skill.name);
        const customerInstructions = settings?.instructions ?? null;
        const instructions = await eta.renderStringAsync(template, { customerInstructions });

        return {
          loaded: true,
          skill: {
            name: skill.name,
            instructions,
            allowed_tools: skill.allowedTools,
          },
        };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  });
}

type SettingsResult = { instructions: string | null } | 'disabled' | null;

async function resolveSettings(botId: number, skillName: string): Promise<SettingsResult> {
  if (skillName !== BOOK_APPOINTMENT_SKILL) return null;

  const settingsRepo = container.resolve<AppointmentBookingSettingsRepository>('AppointmentBookingSettingsRepository');
  const settings = await settingsRepo.findByBotId(botId);
  if (!settings?.isEnabled) return 'disabled';
  return { instructions: settings.instructions };
}
