import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../../../src/services/user-service.js';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../../../src/lib/errors.js';

const makeUser = (overrides: object = {}) => ({
  id: 10, firstName: 'John', lastName: null, phoneNumberId: 1,
  accessTokenNonce: 0, refreshTokenNonce: 0, jwtPrivateKey: 'pk', jwtPublicKey: 'pub', companyId: null,
  ...overrides,
});

const makeAuth = () => ({
  access_token: { jwt: 'access-jwt', expires_at: 9999 },
  refresh_token: { jwt: 'refresh-jwt', expires_at: 99999 },
});

describe('UserService', () => {
  let db: any;
  let userRepo: any;
  let phoneNumberRepo: any;
  let botRepo: any;
  let callSettingsRepo: any;
  let voiceRepo: any;
  let appointmentBookingSettingsRepo: any;
  let companyRepo: any;
  let authService: any;
  let otpService: any;
  let service: UserService;

  beforeEach(() => {
    db = { transaction: vi.fn().mockImplementation(async (cb: any) => cb({})) };
    userRepo = { create: vi.fn(), findById: vi.fn(), findByPhoneNumberId: vi.fn(), update: vi.fn() };
    phoneNumberRepo = { create: vi.fn(), findByE164: vi.fn() };
    botRepo = { create: vi.fn(), findByUserId: vi.fn() };
    callSettingsRepo = { create: vi.fn(), findByUserId: vi.fn() };
    voiceRepo = { findFirst: vi.fn() };
    appointmentBookingSettingsRepo = { upsertByBotId: vi.fn().mockResolvedValue({ id: 5, botId: 2, isEnabled: false }) };
    companyRepo = { create: vi.fn().mockResolvedValue({ id: 99, name: "John's Business" }) };
    authService = {
      generateKeyPair: vi.fn().mockReturnValue({ privateKey: 'pk', publicKey: 'pub' }),
      generateTokens: vi.fn().mockReturnValue(makeAuth()),
      decodeToken: vi.fn(),
      verifyToken: vi.fn(),
    };
    otpService = { verify: vi.fn() };
    service = new UserService(
      db, userRepo, phoneNumberRepo, botRepo,
      callSettingsRepo, voiceRepo, appointmentBookingSettingsRepo, companyRepo, authService, otpService,
    );
  });

  describe('createUser', () => {
    it('throws BadRequestError when phone number is already in use', async () => {
      phoneNumberRepo.findByE164.mockResolvedValue({ id: 1 });
      await expect(service.createUser({ firstName: 'John', phoneNumber: '+1' })).rejects.toThrow(BadRequestError);
    });

    it('throws NotFoundError when no voices are available', async () => {
      phoneNumberRepo.findByE164.mockResolvedValue(null);
      phoneNumberRepo.create.mockResolvedValue({ id: 1 });
      userRepo.create.mockResolvedValue(makeUser());
      voiceRepo.findFirst.mockResolvedValue(null);

      await expect(service.createUser({ firstName: 'John', phoneNumber: '+1' })).rejects.toThrow(NotFoundError);
    });

    it('creates user with all dependent records and returns auth tokens', async () => {
      phoneNumberRepo.findByE164.mockResolvedValue(null);
      phoneNumberRepo.create.mockResolvedValue({ id: 1 });
      userRepo.create.mockResolvedValue(makeUser());
      voiceRepo.findFirst.mockResolvedValue({ id: 5 });
      botRepo.create.mockResolvedValue({ id: 2, name: "John's Bot", voiceId: 5, settings: {} });
      callSettingsRepo.create.mockResolvedValue({
        id: 4, forwardedPhoneNumberId: 1, companyPhoneNumberId: 1, isBotEnabled: true, ringsBeforeBotAnswer: 3,
      });

      const result = await service.createUser({ firstName: 'John', phoneNumber: '+1' });
      expect(result.user.id).toBe(10);
      expect(result.auth.access_token.jwt).toBe('access-jwt');
      expect(appointmentBookingSettingsRepo.upsertByBotId).toHaveBeenCalledWith(2, { isEnabled: false }, expect.anything());
      expect(companyRepo.create).toHaveBeenCalledWith({ name: "John's Business" }, expect.anything());
    });
  });

  describe('signIn', () => {
    it('throws BadRequestError when no auth method is provided', async () => {
      await expect(service.signIn({ auth: {} })).rejects.toThrow(BadRequestError);
    });

    it('signs in via OTP and returns the user', async () => {
      const user = makeUser();
      otpService.verify.mockResolvedValue({ id: 1, verified: true, phoneNumberE164: '+1' });
      phoneNumberRepo.findByE164.mockResolvedValue({ id: 1 });
      userRepo.findByPhoneNumberId.mockResolvedValue(user);

      const result = await service.signIn({ auth: { otp: { id: 1, code: '123456' } } });
      expect(result.user.id).toBe(10);
    });

    it('throws NotFoundError when OTP phone number is not found', async () => {
      otpService.verify.mockResolvedValue({ id: 1, verified: true, phoneNumberE164: '+1' });
      phoneNumberRepo.findByE164.mockResolvedValue(null);

      await expect(service.signIn({ auth: { otp: { id: 1, code: '123456' } } })).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when OTP user is not found', async () => {
      otpService.verify.mockResolvedValue({ id: 1, verified: true, phoneNumberE164: '+1' });
      phoneNumberRepo.findByE164.mockResolvedValue({ id: 1 });
      userRepo.findByPhoneNumberId.mockResolvedValue(null);

      await expect(service.signIn({ auth: { otp: { id: 1, code: '123456' } } })).rejects.toThrow(NotFoundError);
    });

    it('signs in via refresh token and returns the user', async () => {
      const user = makeUser();
      authService.decodeToken.mockReturnValue({ sub: '10' });
      userRepo.findById.mockResolvedValue(user);
      authService.verifyToken.mockReturnValue({ type: 'refresh', sub: '10' });

      const result = await service.signIn({ auth: { refresh_token: 'some.token' } });
      expect(result.user.id).toBe(10);
    });

    it('throws UnauthorizedError when refresh token has no sub', async () => {
      authService.decodeToken.mockReturnValue({ sub: null });
      await expect(service.signIn({ auth: { refresh_token: 'bad.token' } })).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when refresh token user is not found', async () => {
      authService.decodeToken.mockReturnValue({ sub: '99' });
      userRepo.findById.mockResolvedValue(null);
      await expect(service.signIn({ auth: { refresh_token: 'some.token' } })).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when token type is not refresh', async () => {
      authService.decodeToken.mockReturnValue({ sub: '10' });
      userRepo.findById.mockResolvedValue(makeUser());
      authService.verifyToken.mockReturnValue({ type: 'access', sub: '10' });

      await expect(service.signIn({ auth: { refresh_token: 'some.token' } })).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('updateUser', () => {
    it('throws NotFoundError when user does not exist', async () => {
      userRepo.update.mockResolvedValue(null);
      await expect(service.updateUser(1, { firstName: 'New' })).rejects.toThrow(NotFoundError);
    });

    it('returns the updated user', async () => {
      userRepo.update.mockResolvedValue({ id: 1, firstName: 'New' });
      const result = await service.updateUser(1, { firstName: 'New' });
      expect(result.firstName).toBe('New');
    });
  });
});
