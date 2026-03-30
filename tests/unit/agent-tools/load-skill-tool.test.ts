import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSkillRepo, mockContainer } = vi.hoisted(() => {
  const mockSkillRepo = {
    findByName: vi.fn(),
  };
  const mockContainer = {
    resolve: vi.fn((token: string) => {
      if (token === 'SkillRepository') return mockSkillRepo;
      return undefined;
    }),
  };
  return { mockSkillRepo, mockContainer };
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
      if (token === 'SkillRepository') return mockSkillRepo;
      return undefined;
    });
  });

  it('returns skill data when skill is found', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 5,
      name: 'calendar_booking',
      description: 'Book appointments',
      allowedTools: ['getAvailability', 'bookAppointment'],
    });

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'calendar_booking' });

    expect(result).toEqual({
      loaded: true,
      skill: {
        name: 'calendar_booking',
        instructions: '',
        allowed_tools: ['getAvailability', 'bookAppointment'],
      },
    });
  });

  it('returns not-found when skill does not exist', async () => {
    mockSkillRepo.findByName.mockResolvedValue(undefined);

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'nonexistent' });

    expect(result).toEqual({
      loaded: false,
      message: 'Skill "nonexistent" not found.',
    });
  });
});
