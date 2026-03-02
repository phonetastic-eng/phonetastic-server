import { describe, it, expect, vi } from 'vitest';
import { StubGoogleOAuthService, RealGoogleOAuthService } from '../../../src/services/google-oauth-service.js';

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/consent?stub=true'),
    getToken: vi.fn().mockResolvedValue({
      tokens: {
        access_token: 'real-access-token',
        refresh_token: 'real-refresh-token',
        expiry_date: 9_999_999_999_999,
      },
    }),
  })),
}));

describe('StubGoogleOAuthService', () => {
  const service = new StubGoogleOAuthService();

  it('returns an authorization URL containing the state', () => {
    const url = service.getAuthorizationUrl('my-state');
    expect(url).toContain('state=my-state');
    expect(url).toContain('accounts.google.com');
  });

  it('returns stub tokens for a code exchange', async () => {
    const tokens = await service.exchangeCode('auth-code');
    expect(tokens.accessToken).toBe('stub-access-auth-code');
    expect(tokens.refreshToken).toBe('stub-refresh-auth-code');
    expect(tokens.expiresAt).toBeInstanceOf(Date);
  });
});

describe('RealGoogleOAuthService', () => {
  const service = new RealGoogleOAuthService('client-id', 'client-secret', 'https://redirect.example.com');

  it('generates an authorization URL', () => {
    const url = service.getAuthorizationUrl('state-value');
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('exchanges a code for tokens', async () => {
    const tokens = await service.exchangeCode('auth-code');
    expect(tokens.accessToken).toBe('real-access-token');
    expect(tokens.refreshToken).toBe('real-refresh-token');
    expect(tokens.expiresAt).toBeInstanceOf(Date);
  });
});
