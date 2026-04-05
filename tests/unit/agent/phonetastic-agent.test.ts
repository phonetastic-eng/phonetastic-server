import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { voice, initializeLogger } from '@livekit/agents';

beforeAll(() => {
  initializeLogger({ pretty: false, level: 'silent' });
});

import { llm } from '@livekit/agents';

function stubTool(name: string) {
  return llm.tool({ description: name, parameters: { type: 'object', properties: {} }, execute: async () => ({ ok: true }) });
}

vi.mock('../../../src/agent-tools/end-call-tool.js', () => ({ createEndCallTool: vi.fn(() => stubTool('endCall')) }));
vi.mock('../../../src/agent-tools/todo-tool.js', () => ({ createTodoTool: vi.fn(() => stubTool('todo')) }));
vi.mock('../../../src/agent-tools/generate-reply-tool.js', () => ({ createGenerateReplyTool: vi.fn(() => stubTool('generateReply')) }));
vi.mock('../../../src/agent-tools/company-info-tool.js', () => ({ createCompanyInfoTool: vi.fn(() => stubTool('companyInfo')) }));
vi.mock('../../../src/agent-tools/calendar-tools.js', () => ({ createGetAvailabilityTool: vi.fn(() => stubTool('getAvailability')), createBookAppointmentTool: vi.fn(() => stubTool('bookAppointment')) }));
vi.mock('../../../src/agent-tools/list-skills-tool.js', () => ({ createListSkillsTool: vi.fn(() => stubTool('listSkills')) }));
vi.mock('../../../src/agent-tools/load-skill-tool.js', () => ({ createLoadSkillTool: vi.fn(() => stubTool('loadSkill')) }));
vi.mock('../../../src/agent/prompt.js', () => ({
  buildPromptData: vi.fn(() => ({})),
  renderPrompt: vi.fn().mockResolvedValue('You are a helpful assistant.'),
}));

import { PhonetasticAgent } from '../../../src/agent/phonetastic-agent.js';

function makeCall(overrides: { provider?: string; greeting?: string } = {}): any {
  return {
    companyId: 10,
    company: { id: 10, name: 'Acme' },
    botParticipant: {
      bot: { id: 2, userId: 5 },
      voice: { provider: overrides.provider ?? 'phonic', externalId: 'sabrina' },
    },
    endUserParticipant: undefined,
  };
}

describe('PhonetasticAgent constructor', () => {
  it('exposes all expected tool keys', () => {
    const agent = new PhonetasticAgent('instructions', { companyId: 1, botId: 2, userId: 3 });
    const tools = Object.keys(agent.toolCtx);
    expect(tools).toContain('endCall');
    expect(tools).toContain('companyInfo');
    expect(tools).toContain('listSkills');
    expect(tools).toContain('loadSkill');
    expect(tools).toContain('getAvailability');
    expect(tools).toContain('bookAppointment');
  });
});

describe('PhonetasticAgent.create', () => {
  it('renders instructions from call data', async () => {
    const agent = await PhonetasticAgent.create(makeCall());
    expect(agent.instructions).toBe('You are a helpful assistant.');
  });

  it('appends greeting to instructions for openai provider', async () => {
    const agent = await PhonetasticAgent.create(makeCall({ provider: 'openai' }), 'Welcome to Acme!');
    expect(agent.instructions).toContain('Welcome to Acme!');
  });

  it('does not append greeting for phonic provider', async () => {
    const agent = await PhonetasticAgent.create(makeCall({ provider: 'phonic' }), 'Welcome to Acme!');
    expect(agent.instructions).not.toContain('Welcome to Acme!');
  });
});

describe('PhonetasticAgent behavioral tests', () => {
  let session: voice.AgentSession;

  beforeEach(async () => {
    const fakeLlm = new voice.testing.FakeLLM([
      { input: 'Hello', content: 'Hi there, how can I help you today?' },
      { input: 'what can you do', toolCalls: [{ name: 'listSkills', args: {} }] },
    ]);
    const agent = new PhonetasticAgent('You are a helpful assistant.', { companyId: 1, botId: 2, userId: 3 });
    session = new voice.AgentSession({ llm: fakeLlm });
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
