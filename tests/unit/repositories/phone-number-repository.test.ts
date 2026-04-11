import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhoneNumberRepository } from '../../../src/repositories/phone-number-repository.js';

describe('PhoneNumberRepository', () => {
  let db: any;
  let repo: PhoneNumberRepository;
  let mockReturning: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;
  let mockWhere: ReturnType<typeof vi.fn>;
  let mockUpdateWhere: ReturnType<typeof vi.fn>;

  let mockOnConflictDoUpdate: ReturnType<typeof vi.fn>;

  const phoneRow = { id: 1, phoneNumberE164: '+15005550100', companyId: null, isVerified: null, label: null, userId: null, botId: null, endUserId: null, contactId: null };

  beforeEach(() => {
    const whereResult: any = Promise.resolve([phoneRow]);
    whereResult.limit = vi.fn().mockResolvedValue([]);

    mockWhere = vi.fn().mockReturnValue(whereResult);
    mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    mockReturning = vi.fn().mockResolvedValue([phoneRow]);
    mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    mockValues = vi.fn().mockReturnValue({ returning: mockReturning, onConflictDoUpdate: mockOnConflictDoUpdate });

    const fromResult: any = { where: mockWhere, innerJoin: vi.fn() };
    fromResult.innerJoin.mockReturnValue(fromResult);

    db = {
      insert: vi.fn().mockReturnValue({ values: mockValues }),
      select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(fromResult) }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: mockUpdateWhere }) }),
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

  describe('findByUserId', () => {
    it('queries by userId and returns the phone number', async () => {
      await repo.findByUserId(5);

      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('findByBotId', () => {
    it('queries by botId and returns the phone number', async () => {
      await repo.findByBotId(7);

      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('findUserByE164', () => {
    it('normalizes the lookup value and joins to users', async () => {
      const userRow = { id: 1, companyId: null, firstName: 'Test', lastName: null, jwtPrivateKey: 'pk', jwtPublicKey: 'pub', accessTokenNonce: 0, refreshTokenNonce: 0, callSettings: {} };
      const joinWhere = vi.fn().mockResolvedValue([{ user: userRow }]);
      const joinResult: any = { where: joinWhere };
      db.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn(), innerJoin: vi.fn().mockReturnValue(joinResult) }) });

      await repo.findUserByE164('15005550100');

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('findBotByE164', () => {
    it('normalizes the lookup value and joins to bots', async () => {
      const botRow = { id: 1, userId: 1, name: 'Bot', voiceId: null, callSettings: {}, appointmentSettings: {} };
      const joinWhere = vi.fn().mockResolvedValue([{ phoneNumber: phoneRow, bot: botRow }]);
      const joinResult: any = { where: joinWhere };
      db.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn(), innerJoin: vi.fn().mockReturnValue(joinResult) }) });

      await repo.findBotByE164('15005550100');

      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('findContactByE164AndCompanyId', () => {
    it('normalizes the lookup value and joins to contacts', async () => {
      await repo.findContactByE164AndCompanyId('15005550100', 5);

      expect(db.select).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('updateBotId', () => {
    it('issues an update query', async () => {
      await repo.updateBotId(1, 7);

      expect(db.update).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('updateEndUserId', () => {
    it('issues an update query', async () => {
      await repo.updateEndUserId(1, 20);

      expect(db.update).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('updateContactId', () => {
    it('issues an update query', async () => {
      await repo.updateContactId(1, 5);

      expect(db.update).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('clearContactIdByContactIds', () => {
    it('does nothing when given an empty array', async () => {
      await repo.clearContactIdByContactIds([]);

      expect(db.update).not.toHaveBeenCalled();
    });

    it('issues a bulk update to null contact_id for given ids', async () => {
      await repo.clearContactIdByContactIds([1, 2, 3]);

      expect(db.update).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });
  });

  describe('upsertForContacts', () => {
    it('does nothing when given an empty array', async () => {
      await repo.upsertForContacts([]);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('normalizes numbers and upserts with onConflictDoUpdate', async () => {
      await repo.upsertForContacts([{ contactId: 1, phoneNumberE164: '15005550100' }]);

      expect(mockValues).toHaveBeenCalledWith([
        expect.objectContaining({ contactId: 1, phoneNumberE164: '+15005550100' }),
      ]);
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it('includes a where guard so owned rows are not overwritten', async () => {
      await repo.upsertForContacts([{ contactId: 1, phoneNumberE164: '15005550100' }]);

      const call = mockOnConflictDoUpdate.mock.calls[0][0];
      expect(call).toHaveProperty('where');
    });
  });
});
