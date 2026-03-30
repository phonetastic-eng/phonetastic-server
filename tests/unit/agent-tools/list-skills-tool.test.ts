import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSkillRepo, mockSettingsRepo, mockContainer } = vi.hoisted(() => {
  const mockSkillRepo = { findAll: vi.fn() };
  const mockSettingsRepo = { findByBotId: vi.fn() };
  const mockContainer = {
    resolve: vi.fn((token: string) => {
      if (token === 'SkillRepository') return mockSkillRepo;
      if (token === 'AppointmentBookingSettingsRepository') return mockSettingsRepo;
      return undefined;
    }),
  };
  return { mockSkillRepo, mockSettingsRepo, mockContainer };
});

vi.mock('../../../src/config/container.js', () => ({
  container: mockContainer,
}));

vi.mock('@livekit/agents', () => ({
  llm: {
    tool: vi.fn(({ execute }) => ({ execute })),
  },
}));

import { createListSkillsTool } from '../../../src/agent-tools/list-skills-tool.js';

describe('createListSkillsTool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all skills when book_appointment is enabled', async () => {
    mockSkillRepo.findAll.mockResolvedValue([
      { id: 1, name: 'book_appointment', description: 'Book appointments', allowedTools: [] },
      { id: 2, name: 'data_analysis', description: 'Analyze data', allowedTools: [] },
    ]);
    mockSettingsRepo.findByBotId.mockResolvedValue({ isEnabled: true });

    const tool = createListSkillsTool(10);
    const result = await tool.execute({});

    expect(result.skills).toHaveLength(2);
    expect(result.skills[0].name).toBe('book_appointment');
    expect(result.skills[1].name).toBe('data_analysis');
    expect(mockSettingsRepo.findByBotId).toHaveBeenCalledWith(10);
  });

  it('excludes book_appointment when settings disabled', async () => {
    mockSkillRepo.findAll.mockResolvedValue([
      { id: 1, name: 'book_appointment', description: 'Book appointments', allowedTools: [] },
      { id: 2, name: 'data_analysis', description: 'Analyze data', allowedTools: [] },
    ]);
    mockSettingsRepo.findByBotId.mockResolvedValue({ isEnabled: false });

    const tool = createListSkillsTool(10);
    const result = await tool.execute({});

    expect(result.skills).toHaveLength(1);
    expect(result.skills[0].name).toBe('data_analysis');
  });

  it('excludes book_appointment when no settings exist', async () => {
    mockSkillRepo.findAll.mockResolvedValue([
      { id: 1, name: 'book_appointment', description: 'Book appointments', allowedTools: [] },
    ]);
    mockSettingsRepo.findByBotId.mockResolvedValue(undefined);

    const tool = createListSkillsTool(10);
    const result = await tool.execute({});

    expect(result.skills).toHaveLength(0);
  });

  it('returns empty array when no skills exist', async () => {
    mockSkillRepo.findAll.mockResolvedValue([]);
    mockSettingsRepo.findByBotId.mockResolvedValue(undefined);

    const tool = createListSkillsTool(10);
    const result = await tool.execute({});

    expect(result.skills).toHaveLength(0);
  });

  it('returns error when database query fails', async () => {
    mockSkillRepo.findAll.mockRejectedValue(new Error('DB connection lost'));
    mockSettingsRepo.findByBotId.mockResolvedValue(undefined);

    const tool = createListSkillsTool(10);
    const result = await tool.execute({});

    expect(result.error).toBe('DB connection lost');
  });
});
