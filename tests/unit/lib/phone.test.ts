import { describe, it, expect } from 'vitest';
import { toE164 } from '../../../src/lib/phone.js';

describe('toE164', () => {
  it('normalizes a number without + prefix', () => {
    expect(toE164('14844814183')).toBe('+14844814183');
  });

  it('passes through a valid E.164 number unchanged', () => {
    expect(toE164('+14844814183')).toBe('+14844814183');
  });

  it('handles a number with country code but no + using region hint', () => {
    expect(toE164('14844814183', 'US')).toBe('+14844814183');
  });

  it('throws on invalid input', () => {
    expect(() => toE164('abc123')).toThrow('Invalid phone number');
  });
});
