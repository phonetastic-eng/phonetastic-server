import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { CallSettingsRepository } from '../repositories/call-settings-repository.js';
import { authGuard } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

/**
 * Registers call settings routes on the Fastify instance.
 *
 * @precondition The DI container must have CallSettingsRepository registered.
 * @postcondition Route PATCH v1/call_settings is available.
 * @param app - The Fastify application instance.
 */
export async function callSettingsController(app: FastifyInstance): Promise<void> {
  const callSettingsRepo = container.resolve<CallSettingsRepository>('CallSettingsRepository');

  app.patch<{
    Body: {
      call_settings: {
        forwarded_phone_number_id?: number;
        company_phone_number_id?: number;
        is_bot_enabled?: boolean;
        rings_before_bot_answer?: number;
      };
    };
  }>('/v1/call_settings', { preHandler: [authGuard] }, async (request, reply) => {
    const existing = await callSettingsRepo.findByUserId(request.userId);
    if (!existing) throw new NotFoundError('Call settings not found');

    const { call_settings } = request.body;
    const updated = await callSettingsRepo.update(existing.id, {
      forwardedPhoneNumberId: call_settings.forwarded_phone_number_id,
      companyPhoneNumberId: call_settings.company_phone_number_id,
      isBotEnabled: call_settings.is_bot_enabled,
      ringsBeforeBotAnswer: call_settings.rings_before_bot_answer,
    });

    return reply.send({
      call_settings: {
        id: updated!.id,
        forwarded_phone_number_id: updated!.forwardedPhoneNumberId,
        company_phone_number_id: updated!.companyPhoneNumberId,
        is_bot_enabled: updated!.isBotEnabled,
        rings_before_bot_answer: updated!.ringsBeforeBotAnswer,
      },
    });
  });
}
