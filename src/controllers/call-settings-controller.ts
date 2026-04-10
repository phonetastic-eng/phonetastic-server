import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { UserRepository } from '../repositories/user-repository.js';
import type { UserCallSettings } from '../db/schema/users.js';
import { authGuard } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';
import type { CallSettings } from '../db/models.js';
import type { AnswerCallsFrom } from '../db/schema/enums.js';

/**
 * Registers call settings routes on the Fastify instance.
 *
 * @precondition The DI container must have UserRepository registered.
 * @postcondition Route PATCH v1/call_settings is available.
 * @param app - The Fastify application instance.
 */
export async function callSettingsController(app: FastifyInstance): Promise<void> {
  const userRepo = container.resolve<UserRepository>('UserRepository');

  app.patch<{
    Body: {
      call_settings: {
        forwarded_phone_number_id?: number;
        company_phone_number_id?: number;
        is_bot_enabled?: boolean;
        rings_before_bot_answer?: number;
        answer_calls_from?: string;
      };
    };
  }>('/v1/call_settings', { preHandler: [authGuard] }, async (request, reply) => {
    const user = await userRepo.findById(request.userId);
    if (!user) throw new NotFoundError('User not found');

    const { call_settings } = request.body;
    const updates: UserCallSettings = {
      ...(call_settings.forwarded_phone_number_id !== undefined && { forwardedPhoneNumberId: call_settings.forwarded_phone_number_id }),
      ...(call_settings.company_phone_number_id !== undefined && { companyPhoneNumberId: call_settings.company_phone_number_id }),
      ...(call_settings.is_bot_enabled !== undefined && { isBotEnabled: call_settings.is_bot_enabled }),
      ...(call_settings.rings_before_bot_answer !== undefined && { ringsBeforeBotAnswer: call_settings.rings_before_bot_answer }),
      ...(call_settings.answer_calls_from !== undefined && { answerCallsFrom: call_settings.answer_calls_from as UserCallSettings['answerCallsFrom'] }),
    };

    const updated = await userRepo.update(user.id, {
      callSettings: { ...user.callSettings, ...updates },
    });

    return reply.send({
      call_settings: formatCallSettings(updated!.callSettings),
    });
  });
}

/**
 * Formats a call settings object to the API response shape.
 *
 * @param cs - The call settings from the user's JSONB column.
 * @returns A snake_case representation of the call settings.
 */
export function formatCallSettings(cs: UserCallSettings) {
  return {
    forwarded_phone_number_id: cs.forwardedPhoneNumberId,
    company_phone_number_id: cs.companyPhoneNumberId,
    is_bot_enabled: cs.isBotEnabled ?? false,
    rings_before_bot_answer: cs.ringsBeforeBotAnswer ?? 3,
    answer_calls_from: cs.answerCallsFrom ?? 'everyone',
  };
}
