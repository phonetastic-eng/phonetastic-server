import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBotSkillRepo, mockContainer } = vi.hoisted(() => {
  const mockBotSkillRepo = {
    findEnabledByBotId: vi.fn(),
  };
  const mockContainer = {
    resolve: vi.fn((token: string) => {
      if (token === 'BotSkillRepository') return mockBotSkillRepo;
      return undefined;
    }),
  };
  return { mockBotSkillRepo, mockContainer };
});

vi.mock('../../../src/config/container.js', () => ({
  container: mockContainer,
}));

vi.mock('@livekit/agents', () => ({
  llm: {
    tool: vi.fn(({ execute }) => ({ execute })),
  },
}));

import { createLoadSkillTool } from '../../../src/agent-tools/load-skill-tool.js';

describe('createLoadSkillTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContainer.resolve.mockImplementation((token: string) => {
      if (token === 'BotSkillRepository') return mockBotSkillRepo;
      return undefined;
    });
  });

  it('returns skill instructions when skill is found and enabled', async () => {
    mockBotSkillRepo.findEnabledByBotId.mockResolvedValue([
      {
        botSkill: { id: 1, botId: 10, skillId: 5, isEnabled: true },
        skill: {
          id: 5,
          name: 'calendar_booking',
          allowedTools: ['getAvailability', 'bookAppointment'],
          description: 'Book appointments',
          instructions: 'Check availability before booking.',
        },
      },
    ]);

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'calendar_booking' });

    expect(result).toEqual({
      loaded: true,
      skill: {
        name: 'calendar_booking',
        instructions: 'Check availability before booking.',
        allowed_tools: ['getAvailability', 'bookAppointment'],
      },
    });
  });

  it('returns not-found when skill is not enabled for the bot', async () => {
    mockBotSkillRepo.findEnabledByBotId.mockResolvedValue([]);

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'nonexistent' });

    expect(result).toEqual({
      loaded: false,
      message: 'Skill "nonexistent" not found or not enabled.',
    });
  });
});
