import { voice, inference, log } from '@livekit/agents';
import { VoiceRepository } from '../repositories/voice-repository.js';
import { BotSettingsRepository } from '../repositories/bot-settings-repository.js';
import type { SessionData } from '../agent.js';

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
  ) {}

  /**
   * Overrides the session TTS engine with the bot's configured voice, if one exists.
   *
   * @precondition session.userData.botId may be undefined (no-op in that case).
   * @postcondition If a voice is configured for the bot, session.tts is replaced
   *   with a Cartesia TTS instance using that voice. Otherwise session is unchanged.
   */
  async configureVoice(): Promise<void> {
    const botVoice = await this.voiceRepo.findByBotId(this.session.userData.botId);
    if (!botVoice) return;
    log().info({ name: botVoice.name, externalId: botVoice.externalId, id: botVoice.id }, 'Using configured voice');
    this.session.tts = new inference.TTS({
      model: 'cartesia/sonic-3',
      voice: botVoice.externalId,
      language: 'en-US',
      modelOptions: { speed: 'normal' },
    });
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
        instructions: `Make the following message sound natural and conversational: "${botSettings.callGreetingMessage}"`,
      });
    } else {
      this.session.generateReply({ instructions: 'Quickly greet the caller and ask how you can help today.' });
    }
  }
}
