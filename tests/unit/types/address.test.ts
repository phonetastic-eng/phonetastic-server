import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AddressSchema } from '../../../src/types/address.js';

describe('AddressSchema', () => {
  it('parses a valid address', () => {
    const result = AddressSchema.parse({
      id: 1,
      companyId: 2,
      streetAddress: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'US',
      label: 'HQ',
    });
    expect(result.city).toBe('Springfield');
  });

  it('throws when companyId is missing', () => {
    expect(() =>
      AddressSchema.parse({
        id: 1,
        streetAddress: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        label: null,
      }),
    ).toThrow(z.ZodError);
  });
});
