import { voice, inference, log } from '@livekit/agents';
import { VoiceRepository } from '../repositories/voice-repository.js';
import { BotSettingsRepository } from '../repositories/bot-settings-repository.js';
import type { SessionData } from '../agent.js';

const TTS_CONFIG: Record<string, { model: inference.TTSModels; language: string }> = {
  cartesia: { model: 'cartesia/sonic-3', language: 'en-US' },
  rime: { model: 'rime/arcana', language: 'en' },
};

/**
 * Configures a LiveKit agent session after a call has been initialized.
 *
 * Handles two independent capabilities: applying a bot-specific TTS voice,
 * and sending the opening greeting to the caller.
 */
export class AgentSessionSetup {
  constructor(
    private readonly voiceRepo: VoiceRepository,
    private readonly botSettingsRepo: BotSettingsRepository,
    private readonly session: voice.AgentSession<SessionData>,
  ) { }

  /**
   * Overrides the session TTS engine with the bot's configured voice, if one exists.
   *
   * @precondition session.userData.botId may be undefined (no-op in that case).
   * @postcondition If a voice is configured for the bot, session.tts is replaced
   *   with a TTS instance matching the voice's provider. Otherwise session is unchanged.
   * @throws Error if the voice has an unknown provider.
   */
  async configureVoice(): Promise<void> {
    const botVoice = await this.voiceRepo.findByBotId(this.session.userData.botId);
    if (!botVoice) return;
    log().info({ name: botVoice.name, externalId: botVoice.externalId, provider: botVoice.provider, id: botVoice.id }, 'Using configured voice');
    this.session.tts = this.buildTTS(botVoice.provider, botVoice.externalId);
  }

  /**
   * Builds a TTS instance for the given provider and voice.
   *
   * @param provider - The TTS provider name (e.g. 'cartesia', 'rime').
   * @param voiceId - The external voice identifier for the provider.
   * @returns A configured inference TTS instance.
   * @throws Error if the provider is not recognized.
   */
  private buildTTS(provider: string, voiceId: string): inference.TTS<inference.TTSModels> {
    const config = TTS_CONFIG[provider];
    if (!config) throw new Error(`Unknown TTS provider: ${provider}`);
    return new inference.TTS({ model: config.model, voice: voiceId, language: config.language });
  }

  /**
   * Sends the opening greeting to the caller.
   *
   * @precondition session.userData.userId may be undefined; a default greeting
   *   is used in that case.
   * @postcondition A reply is generated. If a custom greeting message is configured,
   *   it is awaited for playout before returning. The default greeting is fire-and-forget.
   */
  async sendGreeting(): Promise<void> {
    const { userId } = this.session.userData;
    const botSettings = userId ? await this.botSettingsRepo.findByUserId(userId) : undefined;
    if (botSettings?.callGreetingMessage) {
      await this.session.generateReply({
        instructions: `Quickly make the following message sound natural and conversational: "${botSettings.callGreetingMessage}"`,
      });
    } else {
      this.session.generateReply({ instructions: 'Quickly greet the caller and ask how you can help today.' });
    }
  }
}
