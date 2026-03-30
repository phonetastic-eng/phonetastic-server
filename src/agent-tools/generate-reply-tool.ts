import { llm, voice } from '@livekit/agents';
import type { SessionData } from '../agent.js';

/**
 * Creates a tool that speaks a reply to the caller immediately.
 *
 * Use this to acknowledge the caller before beginning a multi-step task so the
 * caller is not left in silence while the agent plans.
 *
 * @precondition An active voice session must exist.
 * @postcondition The agent speaks the reply and waits for playout to finish.
 * @returns An LLM tool the agent can invoke to generate a spoken reply.
 */
export function createGenerateReplyTool() {
  return llm.tool({
    description:
      'Speaks a reply to the caller immediately. ' +
      'Use this to acknowledge the caller before starting a multi-step task.',
    parameters: {
      type: 'object',
      properties: {
        instructions: {
          type: 'string',
          description: 'Instructions describing what to say to the caller.',
        },
      },
      required: ['instructions'],
    },
    execute: async ({ instructions }: { instructions: string }, { ctx }: any) => {
      try {
        const session = ctx.session as voice.AgentSession<SessionData>;
        await session.generateReply({ instructions }).waitForPlayout();
        return { success: true };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  });
}
