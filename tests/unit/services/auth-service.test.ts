import { describe, it, expect } from 'vitest';
import { AuthService } from '../../../src/services/auth-service.js';

describe('AuthService', () => {
  const service = new AuthService();

  describe('generateKeyPair', () => {
    it('returns PEM-encoded ECDSA key pair', () => {
      const { privateKey, publicKey } = service.generateKeyPair();
      expect(privateKey).toContain('BEGIN PRIVATE KEY');
      expect(publicKey).toContain('BEGIN PUBLIC KEY');
    });
  });

  describe('generateTokens', () => {
    it('returns access and refresh tokens with expiry timestamps', () => {
      const { privateKey } = service.generateKeyPair();
      const tokens = service.generateTokens(42, privateKey, { access: 1, refresh: 2 });
      expect(tokens.access_token.jwt).toBeDefined();
      expect(tokens.access_token.expires_at).toBeGreaterThan(Date.now() / 1000);
      expect(tokens.refresh_token.jwt).toBeDefined();
      expect(tokens.refresh_token.expires_at).toBeGreaterThan(tokens.access_token.expires_at);
    });
  });

  describe('verifyToken', () => {
    it('returns payload for a valid token', () => {
      const { privateKey, publicKey } = service.generateKeyPair();
      const tokens = service.generateTokens(1, privateKey, { access: 0, refresh: 0 });
      const payload = service.verifyToken(tokens.access_token.jwt, publicKey);
      expect(payload.sub).toBe(1);
      expect(payload.type).toBe('access');
    });

    it('throws for a token signed with a different key', () => {
      const { privateKey } = service.generateKeyPair();
      const { publicKey } = service.generateKeyPair();
      const tokens = service.generateTokens(1, privateKey, { access: 0, refresh: 0 });
      expect(() => service.verifyToken(tokens.access_token.jwt, publicKey)).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('returns payload without verification', () => {
      const { privateKey } = service.generateKeyPair();
      const tokens = service.generateTokens(7, privateKey, { access: 0, refresh: 0 });
      const payload = service.decodeToken(tokens.access_token.jwt);
      expect(payload?.sub).toBe(7);
    });

    it('returns null for a malformed token', () => {
      expect(service.decodeToken('not.a.jwt')).toBeNull();
    });
  });
});
