import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { voice, initializeLogger, llm } from '@livekit/agents';
import { LLM } from '@livekit/agents-plugin-openai';

beforeAll(() => {
  initializeLogger({ pretty: false, level: 'silent' });
});

function stubTool(name: string, description: string) {
  return llm.tool({ description, parameters: { type: 'object', properties: {} }, execute: async () => ({ ok: true }) });
}

vi.mock('../../../src/agent-tools/end-call-tool.js', () => ({ createEndCallTool: vi.fn(() => stubTool('endCall', 'Ends the call')) }));
vi.mock('../../../src/agent-tools/todo-tool.js', () => ({ createTodoTool: vi.fn(() => stubTool('todo', 'Manages todos')) }));
vi.mock('../../../src/agent-tools/generate-reply-tool.js', () => ({ createGenerateReplyTool: vi.fn(() => stubTool('generateReply', 'Generates a reply')) }));
vi.mock('../../../src/agent-tools/company-info-tool.js', () => ({ createCompanyInfoTool: vi.fn((_companyId: number) => stubTool('companyInfo', 'Searches company knowledge base')) }));
vi.mock('../../../src/agent-tools/calendar-tools.js', () => ({
  createGetAvailabilityTool: vi.fn((_userId: number) => stubTool('getAvailability', 'Gets available appointment slots')),
  createBookAppointmentTool: vi.fn((_userId: number) => stubTool('bookAppointment', 'Books an appointment')),
}));
vi.mock('../../../src/agent-tools/list-skills-tool.js', () => ({ createListSkillsTool: vi.fn((_botId: number) => stubTool('listSkills', 'Lists all skills available to you. Call this at the start of every conversation to learn what capabilities you have.')) }));
vi.mock('../../../src/agent-tools/load-skill-tool.js', () => ({ createLoadSkillTool: vi.fn((_botId: number) => stubTool('loadSkill', 'Loads a skill')) }));
vi.mock('../../../src/agent/prompt.js', () => ({
  buildInstructions: vi.fn().mockResolvedValue('You are a helpful assistant. Call list_skills at the start of every conversation to discover your capabilities.'),
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
    const realLlm = new LLM({ model: 'gpt-4o-mini' });
    const agent = new PhonetasticAgent(
      'You are a helpful assistant. Call list_skills at the start of every conversation to discover your capabilities.',
      { companyId: 1, botId: 2, userId: 3 },
    );
    session = new voice.AgentSession({ llm: realLlm });
    await session.start({ agent });
  });

  it('produces an assistant message for user input', async () => {
    const result = await session.run({ userInput: 'Hello' }).wait();
    result.expect.containsMessage({ role: 'assistant' });
  });

  it('calls listSkills tool when user asks about capabilities', async () => {
    const result = await session.run({ userInput: 'what can you do' }).wait();
    result.expect.containsFunctionCall({ name: 'listSkills' });
  });
});
