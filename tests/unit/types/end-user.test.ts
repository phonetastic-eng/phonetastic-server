import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { EndUserSchema } from '../../../src/types/end-user.js';

describe('EndUserSchema', () => {
  it('parses a valid end user', () => {
    const result = EndUserSchema.parse({
      id: 1,
      companyId: 2,
      firstName: 'Bob',
      lastName: null,
      email: null,
    });
    expect(result.firstName).toBe('Bob');
  });

  it('throws when companyId is missing', () => {
    expect(() =>
      EndUserSchema.parse({ id: 1, firstName: null, lastName: null, email: null }),
    ).toThrow(z.ZodError);
  });
});
