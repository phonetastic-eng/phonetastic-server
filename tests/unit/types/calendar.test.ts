import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CalendarSchema } from '../../../src/types/calendar.js';

const validCalendar = {
  id: 1,
  userId: 2,
  companyId: 3,
  provider: 'google' as const,
  externalId: null,
  name: null,
  description: null,
  email: 'cal@example.com',
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenExpiresAt: new Date(),
  createdAt: new Date(),
};

describe('CalendarSchema', () => {
  it('parses a valid calendar', () => {
    const result = CalendarSchema.parse(validCalendar);
    expect(result.provider).toBe('google');
  });

  it('throws when email is missing', () => {
    const { email: _, ...rest } = validCalendar;
    expect(() => CalendarSchema.parse(rest)).toThrow(z.ZodError);
  });
});
