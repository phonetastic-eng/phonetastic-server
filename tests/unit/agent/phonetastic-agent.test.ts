import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWaitForPlayout } = vi.hoisted(() => {
  const mockWaitForPlayout = vi.fn().mockResolvedValue(undefined);
  return { mockWaitForPlayout };
});

vi.mock('@livekit/agents', () => ({
  voice: {
    Agent: class {
      session: any;
      constructor(_opts: any) {}
    },
  },
}));

vi.mock('../../../src/agent-tools/end-call-tool.js', () => ({ createEndCallTool: vi.fn() }));
vi.mock('../../../src/agent-tools/todo-tool.js', () => ({ createTodoTool: vi.fn() }));
vi.mock('../../../src/agent-tools/generate-reply-tool.js', () => ({ createGenerateReplyTool: vi.fn() }));
vi.mock('../../../src/agent-tools/company-info-tool.js', () => ({ createCompanyInfoTool: vi.fn() }));
vi.mock('../../../src/agent-tools/calendar-tools.js', () => ({ createGetAvailabilityTool: vi.fn(), createBookAppointmentTool: vi.fn() }));
vi.mock('../../../src/agent-tools/list-skills-tool.js', () => ({ createListSkillsTool: vi.fn() }));
vi.mock('../../../src/agent-tools/load-skill-tool.js', () => ({ createLoadSkillTool: vi.fn() }));

import { PhonetasticAgent } from '../../../src/agent/phonetastic-agent.js';

const CTX = { companyId: 1, botId: 2, userId: 3 };

function makeAgent(provider?: string, greeting?: string) {
  const agent = new PhonetasticAgent('instructions', CTX, provider, greeting);
  agent['session'] = {
    generateReply: vi.fn().mockReturnValue({ waitForPlayout: mockWaitForPlayout }),
  };
  return agent;
}

describe('PhonetasticAgent.onEnter', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when provider is phonic', async () => {
    const agent = makeAgent('phonic');
    await agent.onEnter();
    expect(agent['session'].generateReply).not.toHaveBeenCalled();
  });

  it('does nothing when provider is Phonic (case-insensitive)', async () => {
    const agent = makeAgent('Phonic');
    await agent.onEnter();
    expect(agent['session'].generateReply).not.toHaveBeenCalled();
  });

  it('generates a default greeting when no greeting is set', async () => {
    const agent = makeAgent('openai');
    await agent.onEnter();
    expect(agent['session'].generateReply).toHaveBeenCalledWith({ instructions: 'Greet the caller with a default message.' });
    expect(mockWaitForPlayout).toHaveBeenCalledOnce();
  });

  it('generates a custom greeting when greeting is set', async () => {
    const agent = makeAgent('openai', 'Welcome to Acme!');
    await agent.onEnter();
    expect(agent['session'].generateReply).toHaveBeenCalledWith({ instructions: 'Greet the caller with the following message: Welcome to Acme!' });
    expect(mockWaitForPlayout).toHaveBeenCalledOnce();
  });

  it('generates a default greeting when provider is undefined', async () => {
    const agent = makeAgent(undefined);
    await agent.onEnter();
    expect(agent['session'].generateReply).toHaveBeenCalledWith({ instructions: 'Greet the caller with a default message.' });
  });
});
