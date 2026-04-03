import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { container } from 'tsyringe';
import { getTestApp, getTestDb, closeTestApp } from '../../helpers/test-app.js';
import { cleanDatabase } from '../../helpers/db-cleaner.js';
import { voiceFactory } from '../../factories/index.js';
import { VoiceRepository } from '../../../src/repositories/voice-repository.js';

describe('VoiceRepository.findFirstByProvider', () => {
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

  it('returns the first voice for the given provider ordered by id', async () => {
    await voiceFactory.create({ externalId: 'sabrina', provider: 'phonic' });
    const second = await voiceFactory.create({ externalId: 'alloy', provider: 'openai' });
    await voiceFactory.create({ externalId: 'shimmer', provider: 'openai' });

    const row = await repo.findFirstByProvider('openai');

    expect(row).toBeDefined();
    expect(row!.id).toBe(second.id);
    expect(row!.provider).toBe('openai');
  });

  it('returns undefined when no voice exists for the provider', async () => {
    await voiceFactory.create({ provider: 'phonic' });

    const row = await repo.findFirstByProvider('openai');

    expect(row).toBeUndefined();
  });
});
