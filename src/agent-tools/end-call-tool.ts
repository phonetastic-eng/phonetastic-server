import { llm, voice } from '@livekit/agents';
import { getJobContext } from '@livekit/agents';
import { container } from '../config/container.js';
import type { LiveKitService } from '../services/livekit-service.js';
import { BotSettingsRepository } from '../repositories/bot-settings-repository.js';
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
      const botSettingsRepo = container.resolve<BotSettingsRepository>('BotSettingsRepository');
      const jobCtx = getJobContext();
      const session = ctx.session as voice.AgentSession<SessionData>;
      const room = jobCtx.room;
      const caller = await jobCtx.waitForParticipant();

      // const botSettings = await botSettingsRepo.findByUserId(session.userData.userId!);
      // await sleep(2000);

      // if (botSettings && botSettings.callGoodbyeMessage) {
      //   await session.generateReply({
      //     instructions: `Make the following message sound natural and conversational: "${botSettings.callGoodbyeMessage}"`,
      //   }).waitForPlayout();
      // } else {
      //   await session.generateReply({
      //     instructions: 'Thank the caller for calling and say goodbye.',
      //   }).waitForPlayout();
      // }

      await sleep(2000);
      await livekitService.removeParticipant(room.name!, caller.identity);
      session.shutdown({ drain: true });
      await room.disconnect();
      return { success: true };
    },
  });
}
