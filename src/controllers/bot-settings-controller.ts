import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { BotSettingsRepository } from '../repositories/bot-settings-repository.js';
import { authGuard } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

/**
 * Registers bot settings routes on the Fastify instance.
 *
 * @precondition The DI container must have BotSettingsRepository registered.
 * @postcondition Route PATCH v1/bot_settings is available.
 * @param app - The Fastify application instance.
 */
export async function botSettingsController(app: FastifyInstance): Promise<void> {
  const botSettingsRepo = container.resolve<BotSettingsRepository>('BotSettingsRepository');

  app.patch<{
    Body: { bot_settings: { voice_id?: number; primary_language?: string; call_greeting_message?: string; call_goodbye_message?: string } };
  }>('/v1/bot_settings', { preHandler: [authGuard] }, async (request, reply) => {
    const existing = await botSettingsRepo.findByUserId(request.userId);
    if (!existing) throw new NotFoundError('Bot settings not found');

    const { bot_settings } = request.body;
    const updated = await botSettingsRepo.update(existing.id, {
      voiceId: bot_settings.voice_id,
      primaryLanguage: bot_settings.primary_language,
      callGreetingMessage: bot_settings.call_greeting_message,
      callGoodbyeMessage: bot_settings.call_goodbye_message,
    });

    return reply.send({
      bot_settings: {
        id: updated!.id,
        bot_id: updated!.botId,
        call_greeting_message: updated!.callGreetingMessage,
        call_goodbye_message: updated!.callGoodbyeMessage,
        voice_id: updated!.voiceId,
        primary_language: updated!.primaryLanguage,
      },
    });
  });
}
