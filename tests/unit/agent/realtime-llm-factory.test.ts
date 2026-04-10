import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPhonicModel, mockOpenaiModel, mockXaiModel, mockGoogleModel, mockEnv } = vi.hoisted(() => {
  const mockPhonicModel = vi.fn((opts: any) => ({ _options: { voice: opts?.voice, welcomeMessage: opts?.welcomeMessage }, provider: 'phonic' }));
  const mockOpenaiModel = vi.fn((opts: any) => ({ _options: { voice: opts?.voice }, provider: 'openai' }));
  const mockXaiModel = vi.fn((opts: any) => ({ _options: { voice: opts?.voice, apiKey: opts?.apiKey }, provider: 'xai' }));
  const mockGoogleModel = vi.fn((opts: any) => ({ _options: { voice: opts?.voice, apiKey: opts?.apiKey }, provider: 'google' }));
  const mockEnv = {
    PHONIC_API_KEY: 'test-phonic-key' as string | undefined,
    OPENAI_API_KEY: 'test-openai-key' as string | undefined,
    XAI_API_KEY: 'test-xai-key' as string | undefined,
    GOOGLE_API_KEY: 'test-google-key' as string | undefined,
  };
  return { mockPhonicModel, mockOpenaiModel, mockXaiModel, mockGoogleModel, mockEnv };
});

vi.mock('@livekit/agents-plugin-phonic', () => ({
  realtime: { RealtimeModel: mockPhonicModel },
}));

vi.mock('@livekit/agents-plugin-openai', () => ({
  realtime: { RealtimeModel: mockOpenaiModel },
}));

vi.mock('@livekit/agents-plugin-xai', () => ({
  realtime: { RealtimeModel: mockXaiModel },
}));

vi.mock('@livekit/agents-plugin-google', () => ({
  beta: { realtime: { RealtimeModel: mockGoogleModel } },
}));

vi.mock('../../../src/config/env.js', () => ({ env: mockEnv }));

import { createRealtimeLlm } from '../../../src/agent/realtime-llm-factory.js';

describe('createRealtimeLlm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.PHONIC_API_KEY = 'test-phonic-key';
    mockEnv.OPENAI_API_KEY = 'test-openai-key';
    mockEnv.XAI_API_KEY = 'test-xai-key';
    mockEnv.GOOGLE_API_KEY = 'test-google-key';
  });

  it('returns a phonic model with the given voice', () => {
    const model = createRealtimeLlm('phonic', 'sabrina') as any;
    expect(mockPhonicModel).toHaveBeenCalledOnce();
    expect(model._options.voice).toBe('sabrina');
    expect(model._options.welcomeMessage).toBeUndefined();
  });

  it('sets welcomeMessage on phonic model when greeting is provided', () => {
    const model = createRealtimeLlm('phonic', 'sabrina', 'Hello!') as any;
    expect(model._options.welcomeMessage).toBe('Hello!');
  });

  it('returns an openai model with the given voice', () => {
    const model = createRealtimeLlm('openai', 'alloy') as any;
    expect(mockOpenaiModel).toHaveBeenCalledOnce();
    expect(model._options.voice).toBe('alloy');
  });

  it('does not pass greeting to openai model', () => {
    createRealtimeLlm('openai', 'alloy', 'Hello!');
    expect(mockOpenaiModel).toHaveBeenCalledWith({ voice: 'alloy' });
  });

  it('throws for an unknown provider', () => {
    expect(() => createRealtimeLlm('cartesia', 'voice-id')).toThrow('Unsupported voice provider: cartesia');
  });

  it('throws when PHONIC_API_KEY is absent', () => {
    mockEnv.PHONIC_API_KEY = undefined;
    expect(() => createRealtimeLlm('phonic', 'sabrina')).toThrow('PHONIC_API_KEY');
  });

  it('throws when OPENAI_API_KEY is absent', () => {
    mockEnv.OPENAI_API_KEY = undefined;
    expect(() => createRealtimeLlm('openai', 'alloy')).toThrow('OPENAI_API_KEY');
  });

  it('returns an xai model with the given voice and api key', () => {
    const model = createRealtimeLlm('xai', 'Ara') as any;
    expect(mockXaiModel).toHaveBeenCalledOnce();
    expect(model._options.voice).toBe('Ara');
    expect(model._options.apiKey).toBe('test-xai-key');
  });

  it('does not pass greeting to xai model constructor', () => {
    createRealtimeLlm('xai', 'Ara', 'Hello!');
    expect(mockXaiModel).toHaveBeenCalledWith({ voice: 'Ara', apiKey: 'test-xai-key' });
  });

  it('throws when XAI_API_KEY is absent', () => {
    mockEnv.XAI_API_KEY = undefined;
    expect(() => createRealtimeLlm('xai', 'Ara')).toThrow('XAI_API_KEY is not set');
  });

  it('returns a google model with the given voice and api key', () => {
    const model = createRealtimeLlm('google', 'Puck') as any;
    expect(mockGoogleModel).toHaveBeenCalledOnce();
    expect(model._options.voice).toBe('Puck');
    expect(model._options.apiKey).toBe('test-google-key');
  });

  it('does not pass greeting to google model constructor', () => {
    createRealtimeLlm('google', 'Puck', 'Hello!');
    expect(mockGoogleModel).toHaveBeenCalledWith({ voice: 'Puck', apiKey: 'test-google-key' });
  });

  it('throws when GOOGLE_API_KEY is absent', () => {
    mockEnv.GOOGLE_API_KEY = undefined;
    expect(() => createRealtimeLlm('google', 'Puck')).toThrow('GOOGLE_API_KEY is not set');
  });
});
