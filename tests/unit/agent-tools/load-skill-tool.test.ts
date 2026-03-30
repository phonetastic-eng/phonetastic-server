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

  it('returns template with customer instructions when enabled', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 1, name: 'book_appointment', description: 'Book', allowedTools: ['getAvailability'],
    });
    mockSettingsRepo.findByBotId.mockResolvedValue({ isEnabled: true, instructions: '$50 deposit', triggers: null });
    mockLoadTemplate.mockResolvedValue(
      'System\n<% if (it.customerInstructions) { %>Customer: <%= it.customerInstructions %><% } %>',
    );

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'book_appointment' });

    expect(result.loaded).toBe(true);
    expect(result.skill.instructions).toContain('$50 deposit');
    expect(result.skill.allowed_tools).toEqual(['getAvailability']);
  });

  it('does not pass triggers to the template', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 1, name: 'book_appointment', description: 'Book', allowedTools: [],
    });
    mockSettingsRepo.findByBotId.mockResolvedValue({ isEnabled: true, instructions: null, triggers: 'Only book for new clients' });
    mockLoadTemplate.mockResolvedValue(
      '<% if (it.triggers) { %>Triggers: <%= it.triggers %><% } %>',
    );

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'book_appointment' });

    expect(result.loaded).toBe(true);
    expect(result.skill.instructions).not.toContain('Only book for new clients');
  });

  it('returns disabled when book_appointment is_enabled is false', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 1, name: 'book_appointment', description: 'Book', allowedTools: [],
    });
    mockSettingsRepo.findByBotId.mockResolvedValue({ isEnabled: false, instructions: null });

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'book_appointment' });

    expect(result).toEqual({
      loaded: false,
      message: 'Skill "book_appointment" is not enabled.',
    });
  });

  it('returns disabled when no settings exist for book_appointment', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 1, name: 'book_appointment', description: 'Book', allowedTools: [],
    });
    mockSettingsRepo.findByBotId.mockResolvedValue(undefined);

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'book_appointment' });

    expect(result).toEqual({
      loaded: false,
      message: 'Skill "book_appointment" is not enabled.',
    });
  });

  it('loads non-book_appointment skills without settings check', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 2, name: 'data_analysis', description: 'Analyze', allowedTools: [],
    });
    mockLoadTemplate.mockResolvedValue('Data analysis instructions');

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'data_analysis' });

    expect(result.loaded).toBe(true);
    expect(result.skill.instructions).toContain('Data analysis instructions');
    expect(mockSettingsRepo.findByBotId).not.toHaveBeenCalled();
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

  it('returns error when template load fails', async () => {
    mockSkillRepo.findByName.mockResolvedValue({
      id: 2, name: 'data_analysis', description: 'Analyze', allowedTools: [],
    });
    mockLoadTemplate.mockRejectedValue(new Error('Failed to load skill template "data_analysis"'));

    const tool = createLoadSkillTool(10);
    const result = await tool.execute({ skill_name: 'data_analysis' });

    expect(result.error).toContain('Failed to load skill template');
  });
});
