import { llm } from '@livekit/agents';
import { container } from '../config/container.js';
import type { SkillRepository } from '../repositories/skill-repository.js';

/**
 * Creates a tool that loads a skill's instructions for the agent.
 *
 * @precondition The skill must exist in the skills table.
 * @postcondition The skill name and allowed tools are returned.
 * @param botId - The bot whose context to use for loading settings.
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
      const skillRepo = container.resolve<SkillRepository>('SkillRepository');
      const skill = await skillRepo.findByName(params.skill_name);

      if (!skill) {
        return { loaded: false, message: `Skill "${params.skill_name}" not found.` };
      }

      return {
        loaded: true,
        skill: {
          name: skill.name,
          instructions: '',
          allowed_tools: skill.allowedTools,
        },
      };
    },
  });
}
