import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { OperationHoursSchema } from '../../../src/types/operation-hours.js';

describe('OperationHoursSchema', () => {
  it('parses valid operation hours', () => {
    const result = OperationHoursSchema.parse({
      id: 1,
      companyId: 2,
      dayOfWeek: 1,
      openTime: '09:00',
      closeTime: '17:00',
    });
    expect(result.openTime).toBe('09:00');
  });

  it('throws when openTime is missing', () => {
    expect(() =>
      OperationHoursSchema.parse({ id: 1, companyId: 2, dayOfWeek: 1, closeTime: '17:00' }),
    ).toThrow(z.ZodError);
  });
});
