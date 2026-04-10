import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AppointmentSettingsSchema } from '../../../src/types/appointment-settings.js';

describe('AppointmentSettingsSchema', () => {
  it('parses a fully populated object', () => {
    const result = AppointmentSettingsSchema.parse({
      isEnabled: true,
      triggers: 'keyword',
      instructions: 'Book at noon.',
    });
    expect(result).toEqual({
      isEnabled: true,
      triggers: 'keyword',
      instructions: 'Book at noon.',
    });
  });

  it('accepts an empty object', () => {
    expect(() => AppointmentSettingsSchema.parse({})).not.toThrow();
  });

  it('throws ZodError on invalid field type', () => {
    expect(() => AppointmentSettingsSchema.parse({ isEnabled: 'yes' })).toThrow(z.ZodError);
  });
});
