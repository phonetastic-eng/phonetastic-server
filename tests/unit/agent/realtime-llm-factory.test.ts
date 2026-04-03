import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPhonicModel, mockOpenaiModel, mockGoogleModel, mockEnv } = vi.hoisted(() => {
  const mockPhonicModel = vi.fn((opts: any) => ({ _options: { voice: opts?.voice, welcomeMessage: opts?.welcomeMessage }, provider: 'phonic' }));
  const mockOpenaiModel = vi.fn((opts: any) => ({ _options: { voice: opts?.voice }, provider: 'openai' }));
  const mockGoogleModel = vi.fn((opts: any) => ({ _options: { model: opts?.model, voice: opts?.voice }, provider: 'google' }));
  const mockEnv = {
    PHONIC_API_KEY: 'test-phonic-key' as string | undefined,
    OPENAI_API_KEY: 'test-openai-key' as string | undefined,
    GOOGLE_API_KEY: 'test-google-key' as string | undefined,
  };
  return { mockPhonicModel, mockOpenaiModel, mockGoogleModel, mockEnv };
});

vi.mock('@livekit/agents-plugin-phonic', () => ({ realtime: { RealtimeModel: mockPhonicModel } }));
vi.mock('@livekit/agents-plugin-openai', () => ({ realtime: { RealtimeModel: mockOpenaiModel } }));
vi.mock('@livekit/agents-plugin-google', () => ({ beta: { realtime: { RealtimeModel: mockGoogleModel } } }));
vi.mock('../../../src/config/env.js', () => ({ env: mockEnv }));

import { createRealtimeLlm } from '../../../src/agent/realtime-llm-factory.js';

describe('createRealtimeLlm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.PHONIC_API_KEY = 'test-phonic-key';
    mockEnv.OPENAI_API_KEY = 'test-openai-key';
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

  it('treats null greeting as absent welcomeMessage for phonic', () => {
    const model = createRealtimeLlm('phonic', 'sabrina', null) as any;
    expect(model._options.welcomeMessage).toBeUndefined();
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

  it('returns a google model with the given voice and gemini model id', () => {
    const model = createRealtimeLlm('google', 'Puck') as any;
    expect(mockGoogleModel).toHaveBeenCalledOnce();
    expect(model._options.voice).toBe('Puck');
    expect(model._options.model).toBe('gemini-2.5-flash-native-audio-preview-12-2025');
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

  it('throws when GOOGLE_API_KEY is absent', () => {
    mockEnv.GOOGLE_API_KEY = undefined;
    expect(() => createRealtimeLlm('google', 'Puck')).toThrow('GOOGLE_API_KEY');
  });
});
