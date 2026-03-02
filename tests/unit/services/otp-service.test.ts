import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcrypt';
import { OtpService } from '../../../src/services/otp-service.js';
import { BadRequestError, GoneError, NotFoundError } from '../../../src/lib/errors.js';

describe('OtpService', () => {
  let otpRepo: any;
  let smsService: any;
  let service: OtpService;

  beforeEach(() => {
    otpRepo = { create: vi.fn(), findById: vi.fn() };
    smsService = { send: vi.fn() };
    service = new OtpService(otpRepo, smsService);
  });

  describe('generateAndSend', () => {
    it('stores a hashed OTP and sends an SMS', async () => {
      otpRepo.create.mockResolvedValue({ id: 1, expiresAt: Date.now() + 300_000 });

      const result = await service.generateAndSend('+15551234567');

      expect(otpRepo.create).toHaveBeenCalledOnce();
      expect(smsService.send).toHaveBeenCalledWith('+15551234567', expect.stringContaining('Your code is:'));
      expect(result.id).toBe(1);
    });
  });

  describe('verify', () => {
    it('throws NotFoundError when OTP does not exist', async () => {
      otpRepo.findById.mockResolvedValue(null);
      await expect(service.verify(1, '123456')).rejects.toThrow(NotFoundError);
    });

    it('throws GoneError when OTP has expired', async () => {
      otpRepo.findById.mockResolvedValue({
        id: 1, expiresAt: Date.now() - 1, password: 'hash', phoneNumberE164: '+1',
      });
      await expect(service.verify(1, '123456')).rejects.toThrow(GoneError);
    });

    it('throws BadRequestError for a wrong code', async () => {
      const hash = await bcrypt.hash('correct', 1);
      otpRepo.findById.mockResolvedValue({
        id: 1, expiresAt: Date.now() + 300_000, password: hash, phoneNumberE164: '+1',
      });
      await expect(service.verify(1, 'wrong')).rejects.toThrow(BadRequestError);
    });

    it('returns verified result for the correct code', async () => {
      const hash = await bcrypt.hash('123456', 1);
      otpRepo.findById.mockResolvedValue({
        id: 1, expiresAt: Date.now() + 300_000, password: hash, phoneNumberE164: '+15551234567',
      });

      const result = await service.verify(1, '123456');
      expect(result).toEqual({ id: 1, verified: true, phoneNumberE164: '+15551234567' });
    });
  });
});
