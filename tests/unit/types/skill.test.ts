import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SkillSchema } from '../../../src/types/skill.js';

describe('SkillSchema', () => {
  it('parses a valid skill', () => {
    const result = SkillSchema.parse({
      id: 1,
      name: 'Booking',
      description: 'Books appointments',
      triggers: null,
      allowedTools: ['calendar'],
    });
    expect(result.name).toBe('Booking');
  });

  it('throws when description is missing', () => {
    expect(() =>
      SkillSchema.parse({ id: 1, name: 'Booking', triggers: null, allowedTools: [] }),
    ).toThrow(z.ZodError);
  });
});
