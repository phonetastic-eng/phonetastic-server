import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { container } from 'tsyringe';
import { BotSkillRepository } from '../../../src/repositories/bot-skill-repository.js';
import { companyFactory, phoneNumberFactory, skillFactory } from '../../factories/index.js';
import { users } from '../../../src/db/schema/users.js';
import { bots } from '../../../src/db/schema/bots.js';
import { botSkills } from '../../../src/db/schema/bot-skills.js';

describe('BotSkillRepository', () => {
  let repo: BotSkillRepository;

  beforeAll(async () => {
    await getTestApp();
    repo = container.resolve<BotSkillRepository>('BotSkillRepository');
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  async function makeBot() {
    const company = await companyFactory.create();
    const phone = await phoneNumberFactory.create();
    const [user] = await getTestDb().insert(users).values({
      phoneNumberId: phone.id,
      companyId: company.id,
      firstName: 'Test',
      jwtPrivateKey: 'pk',
      jwtPublicKey: 'pub',
    }).returning();
    const [bot] = await getTestDb().insert(bots).values({
      userId: user.id,
      name: 'Test Bot',
    }).returning();
    return bot;
  }

  describe('findEnabledByBotIdAndSkillName', () => {
    it('returns the bot skill when enabled', async () => {
      const bot = await makeBot();
      const skill = await skillFactory.create({ name: 'calendar_booking' });
      await getTestDb().insert(botSkills).values({
        botId: bot.id,
        skillId: skill.id,
        isEnabled: true,
      });

      const found = await repo.findEnabledByBotIdAndSkillName(bot.id, 'calendar_booking');

      expect(found).toBeDefined();
      expect(found!.botId).toBe(bot.id);
    });

    it('returns undefined when skill is disabled', async () => {
      const bot = await makeBot();
      const skill = await skillFactory.create({ name: 'calendar_booking' });
      await getTestDb().insert(botSkills).values({
        botId: bot.id,
        skillId: skill.id,
        isEnabled: false,
      });

      const found = await repo.findEnabledByBotIdAndSkillName(bot.id, 'calendar_booking');

      expect(found).toBeUndefined();
    });

    it('returns undefined when no matching skill exists', async () => {
      const bot = await makeBot();
      const found = await repo.findEnabledByBotIdAndSkillName(bot.id, 'calendar_booking');
      expect(found).toBeUndefined();
    });
  });

  describe('findEnabledByBotId', () => {
    it('returns only enabled skills with details', async () => {
      const bot = await makeBot();
      const enabledSkill = await skillFactory.create({ name: 'calendar_booking' });
      const disabledSkill = await skillFactory.create({ name: 'faq_answering' });
      await getTestDb().insert(botSkills).values([
        { botId: bot.id, skillId: enabledSkill.id, isEnabled: true },
        { botId: bot.id, skillId: disabledSkill.id, isEnabled: false },
      ]);

      const rows = await repo.findEnabledByBotId(bot.id);

      expect(rows).toHaveLength(1);
      expect(rows[0].skill.name).toBe('calendar_booking');
    });
  });
});
