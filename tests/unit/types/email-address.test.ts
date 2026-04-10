import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { EmailAddressSchema } from '../../../src/types/email-address.js';

describe('EmailAddressSchema', () => {
  it('parses a valid email address', () => {
    const result = EmailAddressSchema.parse({
      id: 1,
      companyId: 2,
      address: 'support@example.com',
      createdAt: new Date(),
    });
    expect(result.address).toBe('support@example.com');
  });

  it('throws when address is missing', () => {
    expect(() =>
      EmailAddressSchema.parse({ id: 1, companyId: 2, createdAt: new Date() }),
    ).toThrow(z.ZodError);
  });
});
