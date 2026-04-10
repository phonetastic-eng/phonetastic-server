import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { OfferingSchema } from '../../../src/types/offering.js';

describe('OfferingSchema', () => {
  it('parses a valid offering', () => {
    const result = OfferingSchema.parse({
      id: 1,
      companyId: 2,
      type: 'service',
      name: 'Consulting',
      description: null,
      priceAmount: '100.00',
      priceCurrency: 'USD',
      priceFrequency: 'hourly',
    });
    expect(result.type).toBe('service');
  });

  it('throws when name is missing', () => {
    expect(() =>
      OfferingSchema.parse({
        id: 1,
        companyId: 2,
        type: 'product',
        description: null,
        priceAmount: null,
        priceCurrency: null,
        priceFrequency: null,
      }),
    ).toThrow(z.ZodError);
  });
});
