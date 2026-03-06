import {
  type JobContext,
  type JobProcess,
  defineAgent,
  log,
  voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import 'dotenv/config';
import { setupContainer, container } from './config/container.js';
import type { CallService } from './services/call-service.js';
import type { LiveKitService } from './services/livekit-service.js';
import type { CompanyRepository } from './repositories/company-repository.js';
import type { BotSkillRepository } from './repositories/bot-skill-repository.js';
import type { BotSettingsRepository } from './repositories/bot-settings-repository.js';
import type { CalendarRepository } from './repositories/calendar-repository.js';
import type { CalendarService } from './services/calendar-service.js';
import { RoomEvent, DisconnectReason } from '@livekit/rtc-node';
import { createEndCallTool } from './agent-tools/end-call-tool.js';
import { createCheckAvailabilityTool, createBookAppointmentTool } from './agent-tools/calendar-tools.js';
import { formatOfferingsText, formatOperationHoursText } from './lib/format-company-text.js';

const CARTESIA_VOICE_ID = '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc';
const CALENDAR_SKILL_NAME = 'calendar_booking';

/** Agent configuration produced by {@link buildAgentConfig}. */
export interface AgentConfig {
  instructions: string;
  tools: Record<string, any>;
  greetingMessage: string;
}

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

/**
 * Builds agent configuration from resolved call context.
 *
 * Loads the company profile, checks whether the calendar booking skill is
 * enabled, and assembles dynamic instructions and tools.
 *
 * @precondition The DI container must be initialized.
 * @param context - The user, company, and bot ids from {@link CallService.initializeInboundCall}.
 * @returns Instructions, tools, and greeting message for the voice agent.
 */
export async function buildAgentConfig(context: {
  userId: number;
  companyId: number;
  botId: number;
}): Promise<AgentConfig> {
  const companyRepo = container.resolve<CompanyRepository>('CompanyRepository');
  const botSkillRepo = container.resolve<BotSkillRepository>('BotSkillRepository');
  const botSettingsRepo = container.resolve<BotSettingsRepository>('BotSettingsRepository');
  const calendarRepo = container.resolve<CalendarRepository>('CalendarRepository');

  const company = await companyRepo.findWithRelations(context.companyId);
  const settings = await botSettingsRepo.findByUserId(context.userId);
  const calendarSkill = await botSkillRepo.findEnabledByBotIdAndSkillName(context.botId, CALENDAR_SKILL_NAME);

  const tools: Record<string, any> = { endCall: createEndCallTool() };
  const instructionParts = buildBaseInstructions(company);

  if (calendarSkill) {
    const calendar = await calendarRepo.findByUserId(context.userId);
    if (calendar) {
      tools.checkAvailability = createCheckAvailabilityTool(context.userId);
      tools.bookAppointment = createBookAppointmentTool(context.userId);
      const timezone = await resolveCalendarTimezone(context.userId);
      instructionParts.push(buildCalendarInstructions(timezone));
    }
  }

  const greetingMessage = settings?.callGreetingMessage
    ?? 'Hi, I\'m your virtual assistant. How can I help you today?';

  return {
    instructions: instructionParts.join('\n\n'),
    tools,
    greetingMessage,
  };
}

function buildBaseInstructions(company: any): string[] {
  const parts: string[] = [];
  const name = company?.name ?? 'our business';
  const type = company?.businessType ?? '';

  parts.push(`You are a virtual phone assistant for ${name}${type ? `, a ${type}` : ''}.`);
  parts.push('Answer questions clearly and concisely.');

  if (company?.offerings?.length) {
    parts.push(`Services offered:\n${formatOfferingsText(company.offerings)}`);
  }
  if (company?.operationHours?.length) {
    parts.push(`Business hours:\n${formatOperationHoursText(company.operationHours)}`);
  }
  if (company?.faqs?.length) {
    const faqText = company.faqs
      .map((f: any) => `Q: ${f.question}\nA: ${f.answer}`)
      .join('\n\n');
    parts.push(`Frequently asked questions:\n${faqText}`);
  }

  return parts;
}

function buildCalendarInstructions(timezone: string | null): string {
  const tzNote = timezone
    ? ` The calendar timezone is ${timezone}. Present all times in this timezone.`
    : '';
  return (
    'You can check calendar availability and book appointments. ' +
    'When a caller wants to book, first check availability for their desired date, ' +
    'then confirm the time slot with the caller before booking. ' +
    'Always confirm all details before creating the appointment.' +
    tzNote
  );
}

async function resolveCalendarTimezone(userId: number): Promise<string | null> {
  try {
    const calendarService = container.resolve<CalendarService>('CalendarService');
    const today = new Date().toISOString().slice(0, 10);
    const result = await calendarService.checkAvailability(userId, today);
    return result.timezone;
  } catch {
    return null;
  }
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
    setupContainer();
  },
  entry: async (ctx: JobContext) => {
    const callService = container.resolve<CallService>('CallService');
    const livekitService = container.resolve<LiveKitService>('LiveKitService');
    const roomName = ctx.job.room?.name ?? '';

    ctx.room.on(RoomEvent.ParticipantDisconnected, async (participant) => {
      const { state, failureReason } = disconnectReasonToState(participant.disconnectReason);
      log().info({ state, failureReason }, 'Participant disconnected');
      await callService.onEndUserDisconnected(roomName, state, failureReason);
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt: 'deepgram/nova-3',
      llm: 'openai/gpt-4o',
      tts: `cartesia/sonic:${CARTESIA_VOICE_ID}`,
      turnDetection: new livekit.turnDetector.MultilingualModel(),
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
      log().info({ state, failureReason }, 'Session closed');
      await callService.onSessionClosed(roomName, state, failureReason);
      await livekitService.deleteRoom(roomName);
      ctx.shutdown();
    });

    session.on(voice.AgentSessionEventTypes.Error, async (ev: voice.ErrorEvent) => {
      const error: any = ev.error;
      if (error?.recoverable) {
        log().error('Recoverable error', ev.error);
      } else {
        log().error('Unrecoverable error', ev.error);
      }
    });

    const agent = new voice.Agent({
      instructions: 'You are a helpful phone assistant. Answer questions clearly and concisely.',
      tools: {
        endCall: createEndCallTool()
      }
    });
    await session.start({ agent, room: ctx.room });
    await ctx.connect();

    log().info({ roomName }, 'Call connected');

    const caller = await ctx.waitForParticipant();
    let agentConfig: AgentConfig | undefined;
    try {
      if (isTestCall(roomName)) {
        log().info({ caller }, 'Caller found');
        await callService.onParticipantJoined(roomName);
      } else {
        log().info({ caller }, 'Caller found');
        const from = caller.attributes['sip.phoneNumber'];
        const to = caller.attributes['sip.trunkPhoneNumber'];
        log().info({ from, to }, 'Initializing inbound call');
        const callContext = await callService.initializeInboundCall(roomName, from, to);
        log().info('Inbound call initialized');
        agentConfig = await buildAgentConfig(callContext);
        log().info({ hasCalendarTools: 'bookAppointment' in agentConfig.tools }, 'Agent config built');
      }
    } catch (err: any) {
      log().error({ err }, 'Failed to initialize inbound call');
      await session.generateReply({
        instructions: 'Inform the caller that something went wrong and to try again later.',
      }).waitForPlayout();
      await sleep(2000);
      await livekitService.removeParticipant(roomName, caller.identity);
      session.shutdown({ drain: true, reason: voice.CloseReason.ERROR });
      await ctx.room.disconnect();
      return;
    }

    log().info('Generating initial reply');
    const greeting = agentConfig?.greetingMessage
      ?? 'Hi, I\'m Kate, your virtual assistant. How can I help you today?';
    session.generateReply({
      instructions: `Say "${greeting}"`,
    });
  }
});
