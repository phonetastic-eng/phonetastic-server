import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockReadFile } = vi.hoisted(() => {
  const mockReadFile = vi.fn();
  return { mockReadFile };
});

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

import { loadSkillTemplate, clearTemplateCache } from '../../../src/agent/skill-template-loader.js';

describe('loadSkillTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTemplateCache();
  });

  it('reads the template file and returns its content', async () => {
    mockReadFile.mockResolvedValue('template content');
    const result = await loadSkillTemplate('book_appointment');

    expect(result).toBe('template content');
    expect(mockReadFile).toHaveBeenCalledOnce();
    expect(mockReadFile.mock.calls[0][0]).toContain('book_appointment.eta');
  });

  it('caches the template after first read', async () => {
    mockReadFile.mockResolvedValue('cached content');

    await loadSkillTemplate('book_appointment');
    const result = await loadSkillTemplate('book_appointment');

    expect(result).toBe('cached content');
    expect(mockReadFile).toHaveBeenCalledOnce();
  });

  it('throws when the template file does not exist', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    await expect(loadSkillTemplate('nonexistent')).rejects.toThrow('ENOENT');
  });
});
