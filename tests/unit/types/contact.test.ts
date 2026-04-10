import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ContactSchema } from '../../../src/types/contact.js';

describe('ContactSchema', () => {
  it('parses a valid contact', () => {
    const result = ContactSchema.parse({
      id: 1,
      userId: 2,
      companyId: 3,
      deviceId: 'device-abc',
      firstName: null,
      lastName: null,
      email: null,
      createdAt: new Date(),
    });
    expect(result.deviceId).toBe('device-abc');
  });

  it('throws when deviceId is missing', () => {
    expect(() =>
      ContactSchema.parse({
        id: 1,
        userId: 2,
        companyId: 3,
        firstName: null,
        lastName: null,
        email: null,
        createdAt: new Date(),
      }),
    ).toThrow(z.ZodError);
  });
});
