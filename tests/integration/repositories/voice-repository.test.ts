import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { container } from 'tsyringe';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { voiceFactory } from '../../factories/index.js';
import { VoiceRepository } from '../../../src/repositories/voice-repository.js';

describe('VoiceRepository', () => {
  let repo: VoiceRepository;

  beforeAll(async () => {
    await getTestApp();
    repo = container.resolve<VoiceRepository>('VoiceRepository');
  });

  beforeEach(async () => {
    await cleanDatabase(getTestDb());
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('findFirstByProvider', () => {
    it('returns the lowest-id row for the given provider', async () => {
      const first = await voiceFactory.create({ provider: 'google', externalId: 'Puck' });
      await voiceFactory.create({ provider: 'google', externalId: 'Charon' });
      await voiceFactory.create({ provider: 'phonic', externalId: 'sabrina' });

      const result = await repo.findFirstByProvider('google');

      expect(result).toBeDefined();
      expect(result!.id).toBe(first.id);
      expect(result!.provider).toBe('google');
    });

    it('returns undefined for an unknown provider', async () => {
      await voiceFactory.create({ provider: 'phonic', externalId: 'sabrina' });

      const result = await repo.findFirstByProvider('unknown');

      expect(result).toBeUndefined();
    });

    it('returns the correct row when multiple providers are present', async () => {
      await voiceFactory.create({ provider: 'phonic', externalId: 'sabrina' });
      const openaiVoice = await voiceFactory.create({ provider: 'openai', externalId: 'alloy' });
      await voiceFactory.create({ provider: 'google', externalId: 'Puck' });

      const result = await repo.findFirstByProvider('openai');

      expect(result!.id).toBe(openaiVoice.id);
    });
  });
});
