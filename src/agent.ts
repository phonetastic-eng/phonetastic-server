import {
  type JobContext,
  type JobProcess,
  defineAgent,
  ServerOptions,
  voice,
  inference,
  cli
} from '@livekit/agents';
import * as silero from '@livekit/agents-plugin-silero';
import 'dotenv/config';
import { setupContainer, container } from './config/container.js';
import type { CallService } from './services/call-service.js';
import type { LiveKitService } from './services/livekit-service.js';
import { RoomEvent, DisconnectReason } from '@livekit/rtc-node';
import { createEndCallTool } from './agent-tools/end-call-tool.js';
import { createGetAvailabilityTool, createBookAppointmentTool } from './agent-tools/calendar-tools.js';
import { createCompanyInfoTool } from './agent-tools/company-info-tool.js';
import { createTodoTool } from './agent-tools/todo-tool.js';
import { createLoadSkillTool } from './agent-tools/load-skill-tool.js';
import { VoiceRepository } from './repositories/voice-repository.js';
import { BotSettingsRepository } from './repositories/bot-settings-repository.js';
import { CompanyRepository } from './repositories/company-repository.js';
import { BotRepository } from './repositories/bot-repository.js';
import { EndUserRepository } from './repositories/end-user-repository.js';
import { NoiseCancellation } from '@livekit/noise-cancellation-node';

import { Eta } from 'eta';
import { env } from './config/env.js';
import * as livekit from '@livekit/agents-plugin-livekit';
import { createLogger } from './lib/logger.js';
import { trace } from '@opentelemetry/api';
import type { Logger } from 'pino';

export type SessionData = {
  companyId: number | undefined;
  userId: number | undefined;
  botId: number | undefined;
}

const log = createLogger('agent');
const tracer = trace.getTracer('phonetastic-agent');
const eta = new Eta();

const systemPrompt = `
---
company:
  id: <%= it.company.id %>
  name: <%= it.company.name || 'unknown' %>
  businessType: <%= it.company.businessType || 'unknown' %>
  email: <%= it.company.email || 'unknown' %>
  website: <%= it.company.website || 'unknown' %>
caller:
  id: <%= it.caller.id %>
  firstName: <%= it.caller.firstName || 'unknown' %>
  lastName: <%= it.caller.lastName || 'unknown' %>
assistant:
  id: <%= it.assistant.id %>
  name: <%= it.assistant.name || 'unknown' %>
dow: <%= it.dow %>
time: <%= it.time || 'unknown' %>
---

<principles>
You are not a chatbot.  You are the worlds greatest executive assistant.
## Core Truths
- **Be genuinely helpful, not performatively helpful.** Skip the "Great question!" and "I'd be happy to help!" — just help. Actions speak louder than filler words.
- **Earn trust through competence.** Your human has trusted you to represent them and their business.  Guard their reputation with your life.  Be careful with customer facing words and messages.
- **Be unreasonably hospitable.** Always strive to give the caller more than they expect. Every touchpoint is an opportunity to exceed expectations, and build a lasting relationship with the customer.
- **Remember you're a guest.** You have access to someone's business — their messages, calendar, and customers. That's intimacy. Treat it with respect.
- **Find meaning in your work.** Give a shit about the company, the caller, and yourself. Do your best work, every time.  Laugh, smile, and have fun.

## Boundaries
- **Never disclose sensitive information about the caller or the company.**
- **Never treat the caller or the company with disrespect.**
- **Never act deceitfully or dishonestly.**

## Vibe
Be the assistant you'd actually want to talk to. Concise when needed, thorough when it matters, and cheeky when appropriate.
</principles>

<instructions>
## Your Job

Help the customer using ONLY the tools and skills available to you.

Tell the customer only what your skills enable you to do. If they ask for something outside your skills, say you cannot help with that on this line.

End the call once the customer confirms they need nothing more.

Format every response using the rules in <output_formatting>.
</instructions>

<output_formatting>
EVERY response must follow these rules without exception.

- **Speak, don't write.** No markdown, bullets, headers, or formatting — only words you'd say aloud on a phone.
- **Keep it short.** 1-2 sentences per turn. Spread topics across turns, not into monologues.
- **Use dashes for natural pauses.** Pair them with filler words: "Yeah, um - so - let me pull that up." / "Hmm, - let me think." / "Right so - I can sort that."
- **Use contractions always.** "I'll", "you're", "can't". Start sentences with "So", "And", "But", "Right so." Ask short questions: "What time works?"
- **Tone: calm, warm, positive, confident.** Acknowledge frustration before moving forward. Use [laughter] for genuine warmth only.

## Spoken Formats
- Dates: "tomorrow", "next Tuesday", "April 20th" — never "04/20/2023"
- Times: "3 PM", "around noon" — always include AM/PM
- Phone numbers: spell in groups with pauses — "555 - 867 - 5309"
- Codes/IDs: spell each character — "A - B - 3"

## Never Say
"Great question!" / "Certainly!" / "Absolutely!" / "Of course!" / "I'd be happy to..." / "I'd be glad to..." — say "Anything else?" not "Is there anything else I can help you with today?"
</output_formatting>
`

const CARTESIA_VOICE_ID = '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';

function isTestCall(roomName: string): boolean {
  return roomName.startsWith('test-');
}

function disconnectReasonToState(reason?: DisconnectReason): { state: 'finished' | 'failed'; failureReason?: string } {
  switch (reason) {
    case DisconnectReason.USER_REJECTED: return { state: 'failed', failureReason: 'User rejected call' };
    case DisconnectReason.USER_UNAVAILABLE: return { state: 'failed', failureReason: 'User unavailable' };
    case DisconnectReason.SIP_TRUNK_FAILURE: return { state: 'failed', failureReason: 'SIP trunk failure' };
    case DisconnectReason.JOIN_FAILURE: return { state: 'failed', failureReason: 'Join failure' };
    case DisconnectReason.SIGNAL_CLOSE: return { state: 'failed', failureReason: 'Signal connection closed unexpectedly' };
    case DisconnectReason.STATE_MISMATCH: return { state: 'failed', failureReason: 'State mismatch' };
    case DisconnectReason.CONNECTION_TIMEOUT: return { state: 'failed', failureReason: 'Connection timeout' };
    case DisconnectReason.MEDIA_FAILURE: return { state: 'failed', failureReason: 'Media failure' };
    default: return { state: 'finished' };
  }
}

function closeReasonToState(ev: voice.CloseEvent): { state: 'finished' | 'failed'; failureReason?: string } {
  if (ev.reason === voice.CloseReason.ERROR) {
    return { state: 'failed', failureReason: ev.error?.error?.message ?? 'Unknown error' };
  }
  return { state: 'finished' };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPromptData(data?: {
  company?: { id: number; name: string; businessType: string | null; email: string | null; website: string | null };
  bot?: { id: number; name: string };
  endUser?: { id: number; firstName: string | null; lastName: string | null };
}) {
  return {
    company: data?.company ?? { id: 'unknown', name: 'unknown', businessType: 'unknown', email: 'unknown', website: 'unknown' },
    caller: data?.endUser ?? { id: 'unknown', firstName: 'unknown', lastName: 'unknown' },
    assistant: data?.bot ?? { id: 'unknown', name: 'unknown' },
    dow: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
    time: new Date().toISOString(),
  };
}

function logMetrics(entryLog: Logger, m: any) {
  switch (m.type) {
    case 'eou_metrics':
      entryLog.info({ eouDelayMs: m.endOfUtteranceDelayMs, transcriptionDelayMs: m.transcriptionDelayMs }, 'EOU metrics');
      break;
    case 'llm_metrics':
      entryLog.info({ llmTtftMs: m.ttftMs, llmDurationMs: m.durationMs, llmPromptTokens: m.promptTokens, llmCompletionTokens: m.completionTokens }, 'LLM metrics');
      break;
    case 'tts_metrics':
      entryLog.info({ ttsTtfbMs: m.ttfbMs, ttsDurationMs: m.durationMs }, 'TTS metrics');
      break;
    case 'stt_metrics':
      entryLog.info({ durationMs: m.durationMs }, 'STT metrics');
      break;
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    log.info('Prewarm started');
    proc.userData.vad = await silero.VAD.load({
      activationThreshold: 0.85,
    });
    setupContainer();
    log.info('Prewarm complete');
  },
  entry: async (ctx: JobContext) => {
    const roomName = ctx.job.room?.name ?? '';
    let entryLog = log.child({ roomName });

    await tracer.startActiveSpan('agent.session', async (span) => {
      span.setAttribute('roomName', roomName);
      try {
        await runSession(ctx, entryLog, span, roomName);
      } catch (err: any) {
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  }
});

async function runSession(
  ctx: JobContext,
  entryLog: Logger,
  sessionSpan: any,
  roomName: string,
) {
  entryLog.info('Entry started');
  const callService = container.resolve<CallService>('CallService');
  const livekitService = container.resolve<LiveKitService>('LiveKitService');
  const voiceRepository = container.resolve<VoiceRepository>('VoiceRepository');
  const botSettingsRepo = container.resolve<BotSettingsRepository>('BotSettingsRepository');
  const companyRepo = container.resolve<CompanyRepository>('CompanyRepository');
  const botRepo = container.resolve<BotRepository>('BotRepository');
  const endUserRepo = container.resolve<EndUserRepository>('EndUserRepository');
  const backgroundAudio = new voice.BackgroundAudioPlayer({
    ambientSound: voice.BuiltinAudioClip.OFFICE_AMBIENCE,
    thinkingSound: voice.BuiltinAudioClip.KEYBOARD_TYPING2
  });

  ctx.room.on(RoomEvent.ParticipantDisconnected, async (participant) => {
    const { state, failureReason } = disconnectReasonToState(participant.disconnectReason);
    entryLog.info({ state, failureReason }, 'Participant disconnected');
    await backgroundAudio.close()
    await callService.onEndUserDisconnected(roomName, state, failureReason);
  });

  const session = new voice.AgentSession<SessionData>({
    vad: ctx.proc.userData.vad as silero.VAD,
    stt: 'deepgram/nova-3',
    llm: 'gemini-3-flash-preview',
    tts: `cartesia/sonic:${CARTESIA_VOICE_ID}`,
    turnDetection: new livekit.turnDetector.MultilingualModel(0.3),
    voiceOptions: {
      allowInterruptions: true,
      minInterruptionDuration: 2,
      minInterruptionWords: 5,
      maxToolSteps: 10
    },
    userData: {
      companyId: undefined,
      userId: undefined,
      botId: undefined,
    }
  });

  let lastStateChange = Date.now();
  session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev: voice.AgentStateChangedEvent) => {
    const now = Date.now();
    const elapsedMs = now - lastStateChange;
    entryLog.info({ fromState: ev.oldState, toState: ev.newState, elapsedMs }, 'Agent state changed');
    lastStateChange = now;
  });

  session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev: voice.MetricsCollectedEvent) => {
    logMetrics(entryLog, ev.metrics);
  });

  let transcriptSequence = 0;
  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, async (ev: voice.ConversationItemAddedEvent) => {
    const text = ev.item.textContent;
    const { role } = ev.item;
    if (text && (role === 'user' || role === 'assistant')) {
      await callService.saveTranscriptEntry(roomName, { role, text, sequenceNumber: transcriptSequence++ });
    }
  });

  session.once(voice.AgentSessionEventTypes.Close, async (ev: voice.CloseEvent) => {
    const { state, failureReason } = closeReasonToState(ev);
    entryLog.info({ state, failureReason }, 'Session closed');
    await callService.onSessionClosed(roomName, state, failureReason);
    await livekitService.deleteRoom(roomName);
    ctx.shutdown();
  });

  session.on(voice.AgentSessionEventTypes.Error, async (ev: voice.ErrorEvent) => {
    const error: any = ev.error;
    if (error?.recoverable) {
      entryLog.error({ err: ev.error }, 'Recoverable error');
    } else {
      entryLog.error({ err: ev.error }, 'Unrecoverable error');
    }
  });

  const tools: Record<string, any> = {
    endCall: createEndCallTool(),
    todo: createTodoTool(),
  };

  const agent = new voice.Agent({
    instructions: await eta.renderStringAsync(systemPrompt, buildPromptData()),
    tools,
  });

  await session.start({ agent, room: ctx.room, inputOptions: { noiseCancellation: NoiseCancellation() } });
  await backgroundAudio.start({ room: ctx.room, agentSession: session });
  await ctx.connect();

  entryLog.info('Call connected');

  const caller = await ctx.waitForParticipant();
  let call: Awaited<ReturnType<CallService['initializeInboundCall']>>;
  try {
    call = await initializeCall(entryLog, callService, roomName, caller);

    if (!call) throw new Error('Call not found after initialization');

    const botParticipant = call.participants.find(p => p.type === 'bot');
    const agentParticipant = call.participants.find(p => p.type === 'agent');
    const endUserParticipant = call.participants.find(p => p.type === 'end_user');

    const [company, bot, endUser] = await Promise.all([
      companyRepo.findById(call.companyId),
      botParticipant?.botId ? botRepo.findById(botParticipant.botId) : undefined,
      endUserParticipant?.endUserId ? endUserRepo.findById(endUserParticipant.endUserId) : undefined,
    ]);

    const userId = bot?.userId ?? agentParticipant?.userId ?? undefined;
    session.userData.companyId = call.companyId;
    session.userData.userId = userId;
    session.userData.botId = botParticipant?.botId ?? undefined;

    entryLog = entryLog.child({ companyId: call.companyId, callId: call.id, botId: session.userData.botId });
    sessionSpan.setAttribute('companyId', call.companyId);
    sessionSpan.setAttribute('callId', call.id);

    await configureVoice(entryLog, voiceRepository, session);
    updateAgentWithCallData(session, agent, eta, company, bot, endUser, call, userId, botParticipant);
  } catch (err: any) {
    entryLog.error({ err }, 'Failed to initialize inbound call');
    await session.generateReply({
      instructions: 'Inform the caller that something went wrong and to try again later.',
    }).waitForPlayout();
    await sleep(2000);
    await livekitService.removeParticipant(roomName, caller.identity);
    session.shutdown({ drain: true, reason: voice.CloseReason.ERROR });
    await ctx.room.disconnect();
    return;
  }

  await configureVoicePostInit(entryLog, voiceRepository, session);
  await generateGreeting(entryLog, botSettingsRepo, session);
  entryLog.info('Entry complete');
}

async function initializeCall(
  entryLog: Logger,
  callService: CallService,
  roomName: string,
  caller: any,
) {
  if (isTestCall(roomName)) {
    entryLog.info('Caller found (test call)');
    return callService.onParticipantJoined(roomName);
  }
  const from = caller.attributes['sip.phoneNumber'];
  const to = caller.attributes['sip.trunkPhoneNumber'];
  entryLog.info({ from, to }, 'Initializing inbound call');
  const call = await callService.initializeInboundCall(roomName, from, to);
  entryLog.info('Inbound call initialized');
  return call;
}

async function configureVoice(
  entryLog: Logger,
  voiceRepository: VoiceRepository,
  session: voice.AgentSession<SessionData>,
) {
  const botVoice = await voiceRepository.findByBotId(session.userData.botId);
  if (!botVoice) return;
  entryLog.info({ name: botVoice.name, externalId: botVoice.externalId, id: botVoice.id }, 'Using configured voice');
  session.tts = inference.TTS.fromModelString(`cartesia/sonic:${botVoice.externalId}`);
}

function updateAgentWithCallData(
  session: voice.AgentSession<SessionData>,
  agent: voice.Agent,
  etaEngine: Eta,
  company: any,
  bot: any,
  endUser: any,
  call: any,
  userId: number | undefined,
  botParticipant: any,
) {
  const instructions = etaEngine.renderString(systemPrompt, buildPromptData({ company, bot, endUser }));
  session.updateAgent(new voice.Agent({
    instructions,
    tools: {
      ...agent.toolCtx,
      companyInfo: createCompanyInfoTool(call.companyId),
      getAvailability: createGetAvailabilityTool(userId!),
      bookAppointment: createBookAppointmentTool(userId!),
      loadSkill: createLoadSkillTool(botParticipant?.botId!),
    },
  }));
}

async function configureVoicePostInit(
  entryLog: Logger,
  voiceRepository: VoiceRepository,
  session: voice.AgentSession<SessionData>,
) {
  const botVoice = await voiceRepository.findByBotId(session.userData.botId);
  if (!botVoice) return;
  entryLog.info({ name: botVoice.name, externalId: botVoice.externalId, id: botVoice.id }, 'Using configured voice');
  session.tts = new inference.TTS({
    model: 'cartesia/sonic-3',
    voice: botVoice.externalId,
    language: 'en-US',
    modelOptions: { speed: 'normal' },
  });
}

async function generateGreeting(
  entryLog: Logger,
  botSettingsRepo: BotSettingsRepository,
  session: voice.AgentSession<SessionData>,
) {
  entryLog.info('Generating initial reply');
  const botSettings = await botSettingsRepo.findByUserId(session.userData.userId!);
  if (botSettings && botSettings.callGreetingMessage) {
    await session.generateReply({
      instructions: `Make the following message sound natural and conversational: "${botSettings.callGreetingMessage}"`,
    });
  } else {
    session.generateReply({
      instructions: 'Greet the caller and ask them how you can help them today.',
    });
  }
}

cli.runApp(new ServerOptions({
  agent: __filename,
  agentName: 'phonetastic-agent',
  wsURL: env.LIVEKIT_URL!,
  apiKey: env.LIVEKIT_API_KEY,
  apiSecret: env.LIVEKIT_API_SECRET,
}));
