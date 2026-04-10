import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { CompanySchema } from '../../../src/types/company.js';

describe('CompanySchema', () => {
  it('parses a valid company', () => {
    const result = CompanySchema.parse({
      id: 1,
      name: 'Acme',
      businessType: null,
      website: null,
      emails: null,
    });
    expect(result.name).toBe('Acme');
  });

  it('throws when name is missing', () => {
    expect(() =>
      CompanySchema.parse({ id: 1, businessType: null, website: null, emails: null }),
    ).toThrow(z.ZodError);
  });
});
