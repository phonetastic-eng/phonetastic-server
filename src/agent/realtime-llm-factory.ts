import * as phonic from '@livekit/agents-plugin-phonic';
import * as openai from '@livekit/agents-plugin-openai';
import type { llm } from '@livekit/agents';
import { env } from '../config/env.js';

/**
 * Creates a realtime LLM model for the given voice provider and voice ID.
 *
 * @precondition The required API key env var must be set for the chosen provider.
 * @param provider - The voice provider: 'phonic' or 'openai'.
 * @param externalId - The voice identifier to pass to the provider.
 * @param greeting - Optional greeting message. Applied as welcomeMessage for phonic;
 *   callers are responsible for injecting it into agent instructions for openai.
 * @returns A configured RealtimeModel instance.
 * @throws Error if the provider is unrecognised or the required API key is absent.
 */
export function createRealtimeLlm(
  provider: string,
  externalId: string,
  greeting?: string | null,
): llm.RealtimeModel {
  if (provider === 'phonic') {
    if (!env.PHONIC_API_KEY) throw new Error('PHONIC_API_KEY is not set');
    return new phonic.realtime.RealtimeModel({
      voice: externalId,
      welcomeMessage: greeting ?? undefined,
    });
  }
  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');
    return new openai.realtime.RealtimeModel({ voice: externalId });
  }
  throw new Error(`Unsupported voice provider: ${provider}`);
}
