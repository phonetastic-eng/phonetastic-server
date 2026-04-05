import { voice } from '@livekit/agents';
import type { InboundCall } from '../db/models.js';
import { buildPromptData, renderPrompt } from './prompt.js';
import { createEndCallTool } from '../agent-tools/end-call-tool.js';
import { createTodoTool } from '../agent-tools/todo-tool.js';
import { createGenerateReplyTool } from '../agent-tools/generate-reply-tool.js';
import { createCompanyInfoTool } from '../agent-tools/company-info-tool.js';
import { createGetAvailabilityTool, createBookAppointmentTool } from '../agent-tools/calendar-tools.js';
import { createListSkillsTool } from '../agent-tools/list-skills-tool.js';
import { createLoadSkillTool } from '../agent-tools/load-skill-tool.js';
import type { VoiceProvider } from '../config/env.js';

type AgentCtx = { companyId: number; botId: number; userId: number };

const GREETING_INSTRUCTION_PROVIDERS: ReadonlySet<string> = new Set<VoiceProvider>(['openai', 'xai', 'google']);

/**
 * The Phonetastic voice agent for a single inbound call.
 * Encapsulates the rendered system prompt and all per-call tools.
 */
export class PhonetasticAgent extends voice.Agent {
  /**
   * Creates a PhonetasticAgent from a fully-populated InboundCall.
   *
   * @precondition call.company and call.botParticipant.bot are loaded.
   * @postcondition Returns an Agent with rendered instructions and all per-call tools.
   * @param call - The inbound call domain model.
   * @param greeting - Optional custom greeting. Appended to instructions for non-phonic providers.
   */
  static async create(call: InboundCall, greeting?: string | null): Promise<PhonetasticAgent> {
    const { bot, voice: voiceRow } = call.botParticipant;
    const baseInstructions = await renderPrompt(buildPromptData({
      company: call.company,
      bot,
      endUser: call.endUserParticipant?.endUser,
    }));
    const instructions = appendGreeting(baseInstructions, voiceRow?.provider, greeting);
    return new PhonetasticAgent(instructions, { companyId: call.companyId, botId: bot.id, userId: bot.userId });
  }

  constructor(instructions: string, ctx: AgentCtx) {
    super({ instructions, tools: PhonetasticAgent.buildTools(ctx) });
  }

  private static buildTools(ctx: AgentCtx) {
    return {
      endCall: createEndCallTool(),
      todo: createTodoTool(),
      generateReply: createGenerateReplyTool(),
      companyInfo: createCompanyInfoTool(ctx.companyId),
      getAvailability: createGetAvailabilityTool(ctx.userId),
      bookAppointment: createBookAppointmentTool(ctx.userId),
      listSkills: createListSkillsTool(ctx.botId),
      loadSkill: createLoadSkillTool(ctx.botId),
    };
  }
}

function appendGreeting(instructions: string, provider: string | undefined, greeting: string | null | undefined): string {
  if (!greeting || !provider || !GREETING_INSTRUCTION_PROVIDERS.has(provider)) return instructions;
  return `${instructions}\n\nBegin by greeting the caller with: "${greeting}"`;
}
