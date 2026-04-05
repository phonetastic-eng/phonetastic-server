import { voice } from '@livekit/agents';
import type { InboundCall } from '../db/models.js';
import { buildInstructions } from './prompt.js';
import { createEndCallTool } from '../agent-tools/end-call-tool.js';
import { createTodoTool } from '../agent-tools/todo-tool.js';
import { createGenerateReplyTool } from '../agent-tools/generate-reply-tool.js';
import { createCompanyInfoTool } from '../agent-tools/company-info-tool.js';
import { createGetAvailabilityTool, createBookAppointmentTool } from '../agent-tools/calendar-tools.js';
import { createListSkillsTool } from '../agent-tools/list-skills-tool.js';
import { createLoadSkillTool } from '../agent-tools/load-skill-tool.js';

type AgentCtx = { companyId: number; botId: number; userId: number };

/**
 * The Phonetastic voice agent for a single inbound call.
 * Encapsulates the rendered system prompt and all per-call tools.
 */
export class PhonetasticAgent extends voice.Agent {
  /**
   * Creates a PhonetasticAgent from a fully-populated InboundCall.
   *
   * @precondition call.botParticipant.bot is loaded. call.company is guaranteed
   *   non-null by the InboundCall type.
   * @postcondition Returns an Agent with rendered instructions and all per-call tools.
   * @param call - The inbound call domain model.
   */
  static async create(call: InboundCall): Promise<PhonetasticAgent> {
    const { bot, voice } = call.botParticipant;
    const instructions = await buildInstructions({
      company: call.company,
      bot,
      endUser: call.endUserParticipant?.endUser,
    });
    return new PhonetasticAgent(instructions, { companyId: call.companyId, botId: bot.id, userId: bot.userId });
  }

  /**
   * Creates a PhonetasticAgent with pre-rendered instructions and tools for the given context.
   *
   * @param instructions - The fully-rendered system prompt.
   * @param ctx - Identifiers for the company, bot, and user that own this call.
   */
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
