import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhoneNumberRepository } from '../../../src/repositories/phone-number-repository.js';

describe('PhoneNumberRepository', () => {
  let db: any;
  let repo: PhoneNumberRepository;
  let mockReturning: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;
  let mockWhere: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReturning = vi.fn().mockResolvedValue([{ id: 1, phoneNumberE164: '+15005550100' }]);
    mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
    mockWhere = vi.fn().mockResolvedValue([{ id: 1, phoneNumberE164: '+15005550100' }]);
    db = {
      insert: vi.fn().mockReturnValue({ values: mockValues }),
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) }),
    };
    repo = new PhoneNumberRepository(db);
  });

  describe('create', () => {
    it('normalizes phone number to E.164 before insert', async () => {
      await repo.create({ phoneNumberE164: '15005550100' });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumberE164: '+15005550100' }),
      );
    });
  });

  describe('createMany', () => {
    it('normalizes all phone numbers to E.164 before insert', async () => {
      await repo.createMany([
        { phoneNumberE164: '15005550100' },
        { phoneNumberE164: '(917) 555-1234' },
      ]);

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({ phoneNumberE164: '+15005550100' }),
        expect.objectContaining({ phoneNumberE164: '+19175551234' }),
      ]);
    });
  });

  describe('findByE164', () => {
    it('normalizes the lookup value to E.164', async () => {
      await repo.findByE164('15005550100');

      expect(mockWhere).toHaveBeenCalled();
    });
  });
});
