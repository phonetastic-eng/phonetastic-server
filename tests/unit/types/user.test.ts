import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { UserSchema } from '../../../src/types/user.js';

const validUser = {
  id: 1,
  companyId: null,
  firstName: 'Alice',
  lastName: null,
  jwtPrivateKey: 'priv',
  jwtPublicKey: 'pub',
  accessTokenNonce: 0,
  refreshTokenNonce: 0,
  callSettings: {},
};

describe('UserSchema', () => {
  it('parses a valid user', () => {
    const result = UserSchema.parse(validUser);
    expect(result.firstName).toBe('Alice');
  });

  it('throws when firstName is missing', () => {
    const { firstName: _, ...rest } = validUser;
    expect(() => UserSchema.parse(rest)).toThrow(z.ZodError);
  });
});
