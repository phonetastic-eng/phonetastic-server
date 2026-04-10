import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmsService } from '../../../src/services/sms-service.js';
import { BadRequestError } from '../../../src/lib/errors.js';

describe('SmsService', () => {
  let db: any;
  let smsRepo: any;
  let phoneNumberRepo: any;
  let userRepo: any;
  let telephonyService: any;
  let service: SmsService;

  beforeEach(() => {
    db = {};
    smsRepo = { create: vi.fn(), updateState: vi.fn(), findAllByCompanyId: vi.fn() };
    phoneNumberRepo = { findByUserId: vi.fn(), findByE164: vi.fn(), create: vi.fn() };
    userRepo = { findById: vi.fn() };
    telephonyService = { sendSms: vi.fn() };
    service = new SmsService(db, smsRepo, phoneNumberRepo, userRepo, telephonyService);
  });

  describe('sendSms', () => {
    it('throws when user has no company', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: null });
      await expect(service.sendSms(1, '+15559990000', 'hi')).rejects.toThrow(BadRequestError);
    });

    it('throws when user phone number is not found', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      phoneNumberRepo.findByUserId.mockResolvedValue(null);
      await expect(service.sendSms(1, '+15559990000', 'hi')).rejects.toThrow(BadRequestError);
    });

    it('creates a pending message, sends via telephony, and updates to sent', async () => {
      const fromNumber = { id: 1, phoneNumberE164: '+15551234567' };
      const toNumber = { id: 2, phoneNumberE164: '+15559990000' };
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      phoneNumberRepo.findByUserId.mockResolvedValue(fromNumber);
      phoneNumberRepo.findByE164.mockResolvedValue(toNumber);
      smsRepo.create.mockResolvedValue({ id: 10, state: 'pending' });
      telephonyService.sendSms.mockResolvedValue('SM123');
      smsRepo.updateState.mockResolvedValue(undefined);

      const result = await service.sendSms(1, '+15559990000', 'hello');

      expect(telephonyService.sendSms).toHaveBeenCalledWith('+15559990000', '+15551234567', 'hello');
      expect(smsRepo.updateState).toHaveBeenCalledWith(10, 'sent', 'SM123');
      expect(result.externalMessageSid).toBe('SM123');
      expect(result.state).toBe('sent');
    });

    it('creates the destination phone number if it does not exist', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      phoneNumberRepo.findByUserId.mockResolvedValue({ id: 1, phoneNumberE164: '+15551234567' });
      phoneNumberRepo.findByE164.mockResolvedValue(null);
      phoneNumberRepo.create.mockResolvedValue({ id: 3, phoneNumberE164: '+15559990000' });
      smsRepo.create.mockResolvedValue({ id: 11, state: 'pending' });
      telephonyService.sendSms.mockResolvedValue('SM456');
      smsRepo.updateState.mockResolvedValue(undefined);

      await service.sendSms(1, '+15559990000', 'hello');

      expect(phoneNumberRepo.create).toHaveBeenCalledWith({ phoneNumberE164: '+15559990000' });
    });
  });

  describe('receiveInboundSms', () => {
    it('throws when destination phone number is not found', async () => {
      phoneNumberRepo.findByE164.mockResolvedValue(null);
      await expect(service.receiveInboundSms('+15551111111', '+15552222222', 'hi', 'SM1')).rejects.toThrow(BadRequestError);
    });

    it('throws when destination number has no company', async () => {
      phoneNumberRepo.findByE164.mockResolvedValueOnce({ id: 2, phoneNumberE164: '+15552222222', companyId: null });
      await expect(service.receiveInboundSms('+15551111111', '+15552222222', 'hi', 'SM1')).rejects.toThrow(BadRequestError);
    });

    it('persists an inbound SMS message', async () => {
      phoneNumberRepo.findByE164
        .mockResolvedValueOnce({ id: 2, phoneNumberE164: '+15552222222', companyId: 7 })
        .mockResolvedValueOnce({ id: 1, phoneNumberE164: '+15551111111' });
      smsRepo.create.mockResolvedValue({ id: 20, direction: 'inbound', state: 'received' });

      const result = await service.receiveInboundSms('+15551111111', '+15552222222', 'hello', 'SM999');

      expect(smsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'inbound', state: 'received', externalMessageSid: 'SM999' }),
      );
      expect(result.direction).toBe('inbound');
    });
  });

  describe('listSmsMessages', () => {
    it('throws when user has no company', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: null });
      await expect(service.listSmsMessages(1)).rejects.toThrow(BadRequestError);
    });

    it('returns paginated messages for the company', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      smsRepo.findAllByCompanyId.mockResolvedValue([{ id: 1 }, { id: 2 }]);

      const result = await service.listSmsMessages(1, { limit: 2 });

      expect(smsRepo.findAllByCompanyId).toHaveBeenCalledWith(5, { limit: 2 });
      expect(result).toHaveLength(2);
    });
  });
});
