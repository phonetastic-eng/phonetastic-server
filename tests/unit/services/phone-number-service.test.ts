import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhoneNumberService } from '../../../src/services/phone-number-service.js';

describe('PhoneNumberService', () => {
  let phoneNumberRepo: any;
  let userRepo: any;
  let botRepo: any;
  let livekitService: any;
  let service: PhoneNumberService;

  beforeEach(() => {
    phoneNumberRepo = { create: vi.fn(), findByBotId: vi.fn(), findByE164: vi.fn(), updateBotId: vi.fn() };
    userRepo = { findById: vi.fn(), update: vi.fn() };
    botRepo = { findByUserId: vi.fn() };
    livekitService = { purchasePhoneNumber: vi.fn(), createSipDispatchRule: vi.fn() };
    service = new PhoneNumberService(phoneNumberRepo, userRepo, botRepo, livekitService);
  });

  describe('purchase', () => {
    it('purchases a number from LiveKit and links it to the user’s bot', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, callSettings: {} });
      botRepo.findByUserId.mockResolvedValue({ id: 7 });
      phoneNumberRepo.findByBotId.mockResolvedValue(undefined);
      livekitService.purchasePhoneNumber.mockResolvedValue('+15551234567');
      livekitService.createSipDispatchRule.mockResolvedValue('rule-1');
      phoneNumberRepo.create.mockResolvedValue({ id: 1, phoneNumberE164: '+15551234567', isVerified: true, botId: 7 });

      const result = await service.purchase(1);

      expect(livekitService.purchasePhoneNumber).toHaveBeenCalledWith(undefined);
      expect(livekitService.createSipDispatchRule).toHaveBeenCalledWith('+15551234567');
      expect(phoneNumberRepo.create).toHaveBeenCalledWith({ phoneNumberE164: '+15551234567', isVerified: true, botId: 7 });
      expect(result.phoneNumberE164).toBe('+15551234567');
    });

    it('passes area code to LiveKit', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, callSettings: {} });
      botRepo.findByUserId.mockResolvedValue({ id: 7 });
      phoneNumberRepo.findByBotId.mockResolvedValue(undefined);
      livekitService.purchasePhoneNumber.mockResolvedValue('+14155551234');
      livekitService.createSipDispatchRule.mockResolvedValue('rule-1');
      phoneNumberRepo.create.mockResolvedValue({ id: 2, phoneNumberE164: '+14155551234', isVerified: true });

      await service.purchase(1, '415');

      expect(livekitService.purchasePhoneNumber).toHaveBeenCalledWith('415');
    });

    it('reuses existing sipDispatchRuleId without creating a new one', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, callSettings: { sipDispatchRuleId: 'existing-rule' } });
      botRepo.findByUserId.mockResolvedValue({ id: 7 });
      phoneNumberRepo.findByBotId.mockResolvedValue(undefined);
      livekitService.purchasePhoneNumber.mockResolvedValue('+15551234567');
      phoneNumberRepo.create.mockResolvedValue({ id: 1, phoneNumberE164: '+15551234567', isVerified: true });

      await service.purchase(1);

      expect(livekitService.createSipDispatchRule).not.toHaveBeenCalled();
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('returns the existing bot phone number without provisioning a new one', async () => {
      const existing = { id: 99, phoneNumberE164: '+15559876543', isVerified: true, botId: 7 };
      userRepo.findById.mockResolvedValue({ id: 1, callSettings: { sipDispatchRuleId: 'existing-rule' } });
      botRepo.findByUserId.mockResolvedValue({ id: 7 });
      phoneNumberRepo.findByBotId.mockResolvedValue(existing);

      const result = await service.purchase(1);

      expect(result).toBe(existing);
      expect(livekitService.purchasePhoneNumber).not.toHaveBeenCalled();
      expect(phoneNumberRepo.create).not.toHaveBeenCalled();
    });
  });
});
