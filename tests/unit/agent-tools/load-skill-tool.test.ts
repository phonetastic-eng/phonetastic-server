import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSkillRepo, mockSettingsRepo, mockContainer, mockLoadTemplate } = vi.hoisted(() => {
  const mockSkillRepo = { findByName: vi.fn() };
  const mockSettingsRepo = { findByBotId: vi.fn() };
  const mockContainer = {
    resolve: vi.fn((token: string) => {
      if (token === 'SkillRepository') return mockSkillRepo;
      if (token === 'AppointmentBookingSettingsRepository') return mockSettingsRepo;
      return undefined;
    }),
  };
  const mockLoadTemplate = vi.fn();
  return { mockSkillRepo, mockSettingsRepo, mockContainer, mockLoadTemplate };
});

vi.mock('../../../src/config/container.js', () => ({
  container: mockContainer,
}));

vi.mock('@livekit/agents', () => ({
  llm: {
    tool: vi.fn(({ execute }) => ({ execute })),
  },
}));

vi.mock('../../../src/agent/skill-template-loader.js', () => ({
  loadSkillTemplate: mockLoadTemplate,
}));

import { createLoadSkillTool } from '../../../src/agent-tools/load-skill-tool.js';

describe('createLoadSkillTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns template content when skill found with no customer instructions', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 1, name: 'book_appointment', description: 'Book', allowedTools: ['getAvailability'],
    });
    mockLoadTemplate.mockResolvedValue('System instructions only');
    mockSettingsRepo.findByBotId.mockResolvedValue(undefined);

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'book_appointment' });

    expect(result.loaded).toBe(true);
    expect(result.skill.instructions).toContain('System instructions only');
    expect(result.skill.allowed_tools).toEqual(['getAvailability']);
  });

  it('interpolates customer instructions when settings exist', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 1, name: 'book_appointment', description: 'Book', allowedTools: [],
    });
    mockLoadTemplate.mockResolvedValue(
      'System\n<% if (it.customerInstructions) { %>Customer: <%= it.customerInstructions %><% } %>',
    );
    mockSettingsRepo.findByBotId.mockResolvedValue({ instructions: '$50 deposit required' });

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'book_appointment' });

    expect(result.loaded).toBe(true);
    expect(result.skill.instructions).toContain('$50 deposit required');
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
