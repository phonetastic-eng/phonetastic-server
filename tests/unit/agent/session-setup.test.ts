import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MockTTS } = vi.hoisted(() => {
  const MockTTS = vi.fn();
  return { MockTTS };
});

vi.mock('@livekit/agents', () => ({
  log: () => ({ info: vi.fn(), error: vi.fn() }),
  inference: { TTS: MockTTS },
  voice: {},
}));

import { AgentSessionSetup } from '../../../src/agent/session-setup.js';

function makeSession(userData = {}) {
  return {
    userData: { companyId: undefined, userId: undefined, botId: undefined, ...userData },
    generateReply: vi.fn().mockResolvedValue(undefined),
    tts: undefined,
  } as any;
}

function makeSetup(session: any, voiceResult: any = null, settingsResult: any = null) {
  const voiceRepo = { findByBotId: vi.fn().mockResolvedValue(voiceResult) };
  const botSettingsRepo = { findByUserId: vi.fn().mockResolvedValue(settingsResult) };
  return {
    setup: new AgentSessionSetup(voiceRepo as any, botSettingsRepo as any, session),
    voiceRepo,
    botSettingsRepo,
  };
}

describe('AgentSessionSetup.configureVoice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not change session.tts when no voice is configured for the bot', async () => {
    const session = makeSession({ botId: 1 });
    const { setup } = makeSetup(session, null);

    await setup.configureVoice();

    expect(session.tts).toBeUndefined();
  });

  it('replaces session.tts with a Cartesia TTS instance when a cartesia voice is configured', async () => {
    const botVoice = { id: 1, name: 'Aria', externalId: 'voice-ext-id-123', provider: 'cartesia' };
    const session = makeSession({ botId: 1 });
    const { setup } = makeSetup(session, botVoice);

    await setup.configureVoice();

    expect(MockTTS).toHaveBeenCalledWith({
      model: 'cartesia/sonic-3',
      voice: 'voice-ext-id-123',
      language: 'en-US',
    });
    expect(session.tts).toBeInstanceOf(MockTTS);
  });

  it('replaces session.tts with a Rime TTS instance when a rime voice is configured', async () => {
    const botVoice = { id: 2, name: 'Astra', externalId: 'astra', provider: 'rime' };
    const session = makeSession({ botId: 1 });
    const { setup } = makeSetup(session, botVoice);

    await setup.configureVoice();

    expect(MockTTS).toHaveBeenCalledWith({
      model: 'rime/arcana',
      voice: 'astra',
      language: 'en',
    });
    expect(session.tts).toBeInstanceOf(MockTTS);
  });

  it('skips the voice lookup when botId is undefined', async () => {
    const session = makeSession({ botId: undefined });
    const { setup, voiceRepo } = makeSetup(session, null);

    await setup.configureVoice();

    expect(voiceRepo.findByBotId).toHaveBeenCalledWith(undefined);
    expect(session.tts).toBeUndefined();
  });
});

describe('AgentSessionSetup.sendGreeting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends the custom greeting message when one is configured', async () => {
    const settings = { callGreetingMessage: 'Welcome to Acme!' };
    const session = makeSession({ userId: 42 });
    const { setup } = makeSetup(session, null, settings);

    await setup.sendGreeting();

    expect(session.generateReply).toHaveBeenCalledWith({
      instructions: 'Quickly make the following message sound natural and conversational: "Welcome to Acme!"',
    });
  });

  it('awaits playout of the custom greeting', async () => {
    const settings = { callGreetingMessage: 'Hello!' };
    const session = makeSession({ userId: 42 });
    const { setup } = makeSetup(session, null, settings);

    await setup.sendGreeting();

    expect(session.generateReply).toHaveBeenCalledOnce();
  });

  it('sends the default greeting when no custom message is configured', async () => {
    const session = makeSession({ userId: 42 });
    const { setup } = makeSetup(session, null, null);

    await setup.sendGreeting();

    expect(session.generateReply).toHaveBeenCalledWith({
      instructions: 'Quickly greet the caller and ask how you can help today.',
    });
  });

  it('sends the default greeting without looking up settings when userId is undefined', async () => {
    const session = makeSession({ userId: undefined });
    const { setup, botSettingsRepo } = makeSetup(session, null, null);

    await setup.sendGreeting();

    expect(botSettingsRepo.findByUserId).not.toHaveBeenCalled();
    expect(session.generateReply).toHaveBeenCalledWith({
      instructions: 'Quickly greet the caller and ask how you can help today.',
    });
  });
});
