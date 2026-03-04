import {
  type JobContext,
  type JobProcess,
  defineAgent,
  log,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { DBOSClient } from '@dbos-inc/dbos-sdk';
import 'dotenv/config';
import { setupContainer, container } from './config/container.js';
import { buildDbUrl } from './db/index.js';
import type { CallService } from './services/call-service.js';
import type { LiveKitService } from './services/livekit-service.js';

const CARTESIA_VOICE_ID = '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';

function isTestCall(roomName: string): boolean {
  return roomName.startsWith('test-');
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
    setupContainer();
    proc.userData.dbosClient = await DBOSClient.create(buildDbUrl());
  },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;
    const callService = container.resolve<CallService>('CallService');
    const livekitService = container.resolve<LiveKitService>('LiveKitService');
    const roomName = ctx.job.room?.name ?? '';

    const agent = new voice.Agent({
      instructions: 'You are a helpful phone assistant. Answer questions clearly and concisely.',
    });

    const session = new voice.AgentSession({
      vad,
      stt: 'deepgram/nova-3',
      llm: 'openai/gpt-4o',
      tts: `cartesia/sonic:${CARTESIA_VOICE_ID}`,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
    });

    session.once(voice.AgentSessionEventTypes.Close, async (ev: voice.CloseEvent) => {
      log().info('Session closed');
      await livekitService.deleteRoom(roomName);
      ctx.shutdown()
      return;
    });

    session.on(voice.AgentSessionEventTypes.Error, async (ev: voice.ErrorEvent) => {
      const error: any = ev.error;
      if (error?.recoverable) {
        log().error('Recoverable error', ev.error);
      } else {
        log().error('Unrecoverable error', ev.error);
      }
    });

    await session.start({ agent, room: ctx.room });
    await ctx.connect();

    log().info({ roomName }, 'Call connected');

    const caller = await ctx.waitForParticipant();
    if (isTestCall(roomName)) {
      log().info({ caller }, 'Caller found');
      await callService.onParticipantJoined(roomName);
    } else {
      try {
        log().info({ caller }, 'Caller found');
        const from = caller.attributes['sip.phoneNumber'] ?? '';
        const to = caller.attributes['sip.trunkPhoneNumber'] ?? '';
        log().info({ from, to }, 'Initializing inbound call');
        await callService.initializeInboundCall(roomName, from, to);
        log().info('Inbound call initialized');
      } catch (err: any) {
        log().error({ err }, 'Failed to initialize inbound call');
        await session.generateReply({
          instructions: 'Inform the caller that something went wrong and to try again later.',
        }).waitForPlayout();
        await sleep(2000);
        session.shutdown();
        await ctx.room.disconnect();
        await livekitService.removeParticipant(roomName, caller.identity);
        return;
      }
    }

    log().info('Generating initial reply');
    session.generateReply({
      instructions: 'Say "Hi, I\'m Kate, your virtual assistant. How can I help you today?"',
    });
  }
});

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
