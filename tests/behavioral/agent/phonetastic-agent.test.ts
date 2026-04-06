import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { voice, initializeLogger, llm } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';

beforeAll(() => {
  initializeLogger({ pretty: false, level: 'silent' });
});

// Mock the DI container so tool execute functions don't hit real services.
// Tool registration (descriptions + parameter schemas) uses the real factory code.
vi.mock('../../../src/config/container.js', () => ({
  container: {
    resolve: vi.fn((name: string) => {
      const stubs: Record<string, unknown> = {
        SkillRepository: { findAll: vi.fn().mockResolvedValue([]), findByName: vi.fn().mockResolvedValue(null) },
        AppointmentBookingSettingsRepository: { findByBotId: vi.fn().mockResolvedValue(null) },
        CalendarService: { getAvailability: vi.fn().mockResolvedValue([]), bookAppointment: vi.fn().mockResolvedValue({}) },
        EmbeddingService: { embed: vi.fn().mockResolvedValue([[0.1, 0.2]]) },
        FaqRepository: { searchByEmbedding: vi.fn().mockResolvedValue([]) },
        LiveKitService: { removeParticipant: vi.fn().mockResolvedValue(undefined) },
        BotSettingsRepository: { findByUserId: vi.fn().mockResolvedValue(null) },
      };
      return stubs[name] ?? {};
    }),
  },
}));

// end-call-tool has no parameters, so the stub is schema-equivalent to the real tool.
// We mock it to prevent it from importing agent.ts, which calls cli.runApp() as a side effect.
vi.mock('../../../src/agent-tools/end-call-tool.js', () => ({
  createEndCallTool: vi.fn(() => llm.tool({
    description: 'Ends the call. May only be used after the caller has given consent.',
    execute: async () => ({ success: true }),
  })),
}));

vi.mock('../../../src/agent/prompt.js', () => ({
  buildInstructions: vi.fn().mockResolvedValue(
    'You are a helpful assistant. Call list_skills at the start of every conversation to discover your capabilities.',
  ),
}));

import { PhonetasticAgent } from '../../../src/agent/phonetastic-agent.js';

function makeCall(): any {
  return {
    companyId: 10,
    company: { id: 10, name: 'Acme' },
    botParticipant: {
      bot: { id: 2, userId: 5 },
      voice: { provider: 'phonic', externalId: 'sabrina' },
    },
    endUserParticipant: undefined,
  };
}

describe('PhonetasticAgent.create', () => {
  it('renders instructions from call data', async () => {
    const agent = await PhonetasticAgent.create(makeCall());
    expect(agent.instructions).toBe('You are a helpful assistant. Call list_skills at the start of every conversation to discover your capabilities.');
  });
});

describe('PhonetasticAgent behavioral tests', () => {
  let session: voice.AgentSession;

  beforeEach(async () => {
    const realtimeLlm = new openai.realtime.RealtimeModel({ voice: 'alloy', modalities: ['text'] });
    const agent = new PhonetasticAgent(
      'You are a helpful assistant. Call list_skills at the start of every conversation to discover your capabilities.',
      { companyId: 1, botId: 2, userId: 3 },
    );
    session = new voice.AgentSession({ llm: realtimeLlm, maxToolSteps: 10 });
    await session.start({ agent });
  });

  it('calls listSkills on conversation start', async () => {
    const result = await session.run({ userInput: 'Hello' }).wait();
    result.expect.containsFunctionCall({ name: 'listSkills' });
  });

  it('produces an assistant message in response to user input', async () => {
    // With a realtime model, the follow-up text response arrives asynchronously after
    // tool calls complete. We listen for it via ConversationItemAdded rather than
    // relying on run().wait(), which only captures the initial speech handle.
    const assistantMessage = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('No assistant message within timeout')), 15000);
      session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (ev) => {
        if (ev.item.role === 'assistant' && ev.item.type === 'message') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    session.run({ userInput: 'Hello' });
    await assistantMessage;
  });
});
