import { voice } from '@livekit/agents';
import type { CallContext } from '../db/models.js';
import { buildInstructions } from './prompt.js';
import { createEndCallTool } from '../agent-tools/end-call-tool.js';
import { createTodoTool } from '../agent-tools/todo-tool.js';
import { createGenerateReplyTool } from '../agent-tools/generate-reply-tool.js';
import { createCompanyInfoTool } from '../agent-tools/company-info-tool.js';
import { createGetAvailabilityTool, createBookAppointmentTool } from '../agent-tools/calendar-tools.js';
import { createListSkillsTool } from '../agent-tools/list-skills-tool.js';
import { createLoadSkillTool } from '../agent-tools/load-skill-tool.js';
import { log } from '@livekit/agents';

/**
 * The Phonetastic voice agent for a single inbound call.
 * Encapsulates the rendered system prompt and all per-call tools.
 */
export class PhonetasticAgent extends voice.Agent {
  /**
   * Creates a PhonetasticAgent from a {@link CallContext}.
   *
   * @precondition context.bot, context.company, context.voice are all populated.
   * @postcondition Returns an Agent with rendered instructions and all per-call tools.
   * @param context - The fully-populated call context.
   */
  static async create(context: CallContext): Promise<PhonetasticAgent> {
    const instructions = await buildInstructions({ company: context.company, bot: context.bot });
    return new PhonetasticAgent(instructions, context);
  }

  private static buildTools(context: CallContext) {
    return {
      endCall: createEndCallTool(),
      todo: createTodoTool(),
      generateReply: createGenerateReplyTool(),
      companyInfo: createCompanyInfoTool(context.call.companyId),
      getAvailability: createGetAvailabilityTool(context.bot.userId),
      bookAppointment: createBookAppointmentTool(context.bot.userId),
      listSkills: createListSkillsTool(context.bot.id),
      loadSkill: createLoadSkillTool(context.bot.id),
    };
  }

  private greeting?: string;
  private provider?: string;
  private hasSentGreeting = false;

  /**
   * Creates a PhonetasticAgent with pre-rendered instructions and tools for the given context.
   *
   * @param instructions - The fully-rendered system prompt.
   * @param context - The call context supplying voice provider, greeting, and tool IDs.
   */
  constructor(instructions: string, context: CallContext) {
    super({ instructions, tools: PhonetasticAgent.buildTools(context) });
    this.provider = context.voice.provider;
    this.greeting = context.bot.callSettings.callGreetingMessage ?? undefined;
  }

  /**
   * Greets the caller when the session starts, unless Phonic is the voice provider.
   *
   * @postcondition For non-Phonic providers, the agent has spoken an opening greeting.
   *   For Phonic, the provider handles the greeting via its welcomeMessage config.
   */
  override async onEnter(): Promise<void> {
    log().info({ provider: this.provider, greeting: this.greeting }, 'Started agent on enter');
    if (this.provider?.toLowerCase() === 'phonic') {
      log().info('Phonic provider, skipping greeting');
      return;
    }
    if (!this.greeting || this.hasSentGreeting) return;
    this.hasSentGreeting = true;
    await this.session.generateReply({ instructions: `Quickly greet the caller with this exact message: ${this.greeting}`, toolChoice: 'auto' }).waitForPlayout();
    log().info('Greeting sent');
  }
}
