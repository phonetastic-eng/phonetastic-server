import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { SubdomainSchema } from '../../../src/types/subdomain.js';

const base = {
  id: 1,
  companyId: 1,
  subdomain: 'acme',
  createdAt: new Date(),
};

describe('SubdomainSchema', () => {
  it('parses not_started with null resendDomainId', () => {
    const result = SubdomainSchema.parse({ ...base, status: 'not_started', resendDomainId: null });
    expect(result.status).toBe('not_started');
  });

  it('throws when not_started has a resendDomainId', () => {
    expect(() =>
      SubdomainSchema.parse({ ...base, status: 'not_started', resendDomainId: 'dom_123' }),
    ).toThrow(z.ZodError);
  });

  it('parses pending with resendDomainId', () => {
    const result = SubdomainSchema.parse({ ...base, status: 'pending', resendDomainId: 'dom_123' });
    expect(result.status).toBe('pending');
    expect(result.resendDomainId).toBe('dom_123');
  });

  it('throws when pending lacks resendDomainId', () => {
    expect(() =>
      SubdomainSchema.parse({ ...base, status: 'pending', resendDomainId: null }),
    ).toThrow(z.ZodError);
  });

  it('parses verified with resendDomainId', () => {
    const result = SubdomainSchema.parse({ ...base, status: 'verified', resendDomainId: 'dom_123' });
    expect(result.status).toBe('verified');
  });

  it('parses partially_verified with resendDomainId', () => {
    const result = SubdomainSchema.parse({ ...base, status: 'partially_verified', resendDomainId: 'dom_123' });
    expect(result.status).toBe('partially_verified');
  });

  it('parses partially_failed with nullable resendDomainId', () => {
    const result = SubdomainSchema.parse({ ...base, status: 'partially_failed', resendDomainId: null });
    expect(result.resendDomainId).toBeNull();
  });

  it('parses failed with nullable resendDomainId', () => {
    const result = SubdomainSchema.parse({ ...base, status: 'failed', resendDomainId: 'dom_123' });
    expect(result.status).toBe('failed');
  });

  it('parses temporary_failure with nullable resendDomainId', () => {
    const result = SubdomainSchema.parse({ ...base, status: 'temporary_failure', resendDomainId: null });
    expect(result.status).toBe('temporary_failure');
  });

  it('throws on unknown status', () => {
    expect(() =>
      SubdomainSchema.parse({ ...base, status: 'unknown', resendDomainId: null }),
    ).toThrow(z.ZodError);
  });
});
