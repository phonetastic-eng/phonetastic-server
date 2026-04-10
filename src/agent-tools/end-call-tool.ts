import { llm, voice } from '@livekit/agents';
import { getJobContext } from '@livekit/agents';
import { container } from '../config/container.js';
import type { LiveKitService } from '../services/livekit-service.js';
import { BotRepository } from '../repositories/bot-repository.js';
import type { BotSettings } from '../db/schema/bots.js';
import { SessionData } from '../agent.js';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a tool that ends the current call.
 *
 * @precondition The agent must be in an active LiveKit session.
 * @postcondition The caller is removed and the session shuts down.
 * @returns An LLM tool that the agent can invoke to hang up.
 */
export function createEndCallTool() {
  return llm.tool({
    description: 'Ends the call. May only be used after the caller has given consent.',
    execute: async ({ }, { ctx }) => {
      const livekitService = container.resolve<LiveKitService>('LiveKitService');
      const botRepo = container.resolve<BotRepository>('BotRepository');
      const jobCtx = getJobContext();
      const session = ctx.session as voice.AgentSession<SessionData>;
      const room = jobCtx.room;
      const caller = await jobCtx.waitForParticipant();
      const bot = await botRepo.findByUserId(session.userData.userId!);
      const settings = bot?.settings as BotSettings | undefined;

      if (settings?.callGoodbyeMessage) {
        await session.generateReply({
          instructions: `Say goodbye to the caller using this message: "${settings.callGoodbyeMessage}"`,
        }).waitForPlayout();
      }

      await sleep(5000);
      session.shutdown({ drain: true });
      await livekitService.removeParticipant(room.name!, caller.identity);
      return { success: true };
    },
  });
}
