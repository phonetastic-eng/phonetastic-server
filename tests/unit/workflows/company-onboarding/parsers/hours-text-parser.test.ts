import { describe, it, expect } from 'vitest';
import { parseOpeningHoursText } from '../../../../../src/workflows/company-onboarding/parsers/hours-text-parser.js';

describe('parseOpeningHoursText', () => {
  it('parses a day range and a single day into individual rows', () => {
    const result = parseOpeningHoursText('Mo-Fr 09:00-17:00, Sa 10:00-14:00');
    expect(result).toHaveLength(6);
    expect(result).toContainEqual({ dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' }); // Mo
    expect(result).toContainEqual({ dayOfWeek: 5, openTime: '09:00', closeTime: '17:00' }); // Fr
    expect(result).toContainEqual({ dayOfWeek: 6, openTime: '10:00', closeTime: '14:00' }); // Sa
  });

  it('parses a full-week range into 7 rows', () => {
    const result = parseOpeningHoursText('Mo-Su 00:00-23:59');
    expect(result).toHaveLength(7);
    const days = result.map((r) => r.dayOfWeek).sort();
    expect(days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('splits on newlines as well as commas', () => {
    const result = parseOpeningHoursText('Mo 08:00-12:00\nWe 13:00-17:00');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ dayOfWeek: 1, openTime: '08:00', closeTime: '12:00' });
    expect(result[1]).toEqual({ dayOfWeek: 3, openTime: '13:00', closeTime: '17:00' });
  });

  it('skips entries that do not match the expected format', () => {
    const result = parseOpeningHoursText('By appointment only, Mo-Fr 09:00-17:00');
    expect(result).toHaveLength(5);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseOpeningHoursText('')).toEqual([]);
  });
});
