import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDb } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { companyFactory, endUserFactory, emailAddressFactory, chatFactory, botToolCallFactory } from '../../factories/index.js';
import { BotToolCallRepository } from '../../../src/repositories/bot-tool-call-repository.js';

describe('BotToolCallRepository', () => {
  const db = getTestDb();
  const repo = new BotToolCallRepository(db);

  beforeEach(async () => { await cleanDatabase(db); });

  async function seedChat() {
    const company = await companyFactory.create({ name: 'Acme' });
    const endUser = await endUserFactory.create({ companyId: company.id });
    const emailAddress = await emailAddressFactory.create({ companyId: company.id });
    return chatFactory.create({ companyId: company.id, endUserId: endUser.id, emailAddressId: emailAddress.id });
  }

  describe('create', () => {
    it('persists a tool call and returns the row', async () => {
      const chat = await seedChat();
      const row = await repo.create({
        chatId: chat.id,
        toolCallId: 'tc-abc',
        toolName: 'company_info',
        input: { query: 'pricing' },
        output: { found: true, results: [] },
      });

      expect(row.id).toBeDefined();
      expect(row.toolCallId).toBe('tc-abc');
      expect(row.toolName).toBe('company_info');
      expect(row.input).toEqual({ query: 'pricing' });
      expect(row.output).toEqual({ found: true, results: [] });
    });
  });

  describe('findAllByChatId', () => {
    it('returns tool calls in chronological order', async () => {
      const chat = await seedChat();
      await botToolCallFactory.create({ chatId: chat.id, toolCallId: 'tc-1', toolName: 'company_info' });
      await botToolCallFactory.create({ chatId: chat.id, toolCallId: 'tc-2', toolName: 'reply' });

      const rows = await repo.findAllByChatId(chat.id);

      expect(rows).toHaveLength(2);
      expect(rows[0].toolCallId).toBe('tc-1');
      expect(rows[1].toolCallId).toBe('tc-2');
    });

    it('returns empty array for a chat with no tool calls', async () => {
      const chat = await seedChat();
      const rows = await repo.findAllByChatId(chat.id);
      expect(rows).toHaveLength(0);
    });
  });
});
