import {
  type JobContext,
  type JobProcess,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import { DBOSClient } from '@dbos-inc/dbos-sdk';
import 'dotenv/config';
import { setupContainer, container } from './config/container.js';
import { buildDbUrl } from './db/index.js';
import type { CallService } from './services/call-service.js';

const CARTESIA_VOICE_ID = '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';

function isTestCall(roomName: string): boolean {
  return roomName.startsWith('test-');
}

function parseInboundMetadata(metadata: string): { from: string; to: string } {
  const parsed = JSON.parse(metadata) as { from: string; to: string };
  return { from: parsed.from, to: parsed.to };
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
    const roomName = ctx.room.name ?? '';

    if (!isTestCall(roomName)) {
      const { from, to } = parseInboundMetadata(ctx.room.metadata ?? '{}');
      await callService.initializeInboundCall(roomName, from, to);
    }

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

    await session.start({ agent, room: ctx.room });
    await ctx.connect();

    await ctx.waitForParticipant();

    if (isTestCall(roomName)) {
      await callService.onParticipantJoined(roomName);
    }

    session.generateReply({
      instructions: 'Greet the user and offer your assistance.',
    });
  }
});
