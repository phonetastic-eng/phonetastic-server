import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import type { BotRepository } from '../repositories/bot-repository.js';
import { authGuard } from '../middleware/auth.js';

const MAX_FIELD_LENGTH = 10_000;

/**
 * Registers appointment booking settings routes on the Fastify instance.
 *
 * @precondition The DI container must have BotRepository registered.
 * @postcondition PUT and GET routes for appointment booking settings are available.
 * @param app - The Fastify application instance.
 */
export async function appointmentBookingSettingsController(app: FastifyInstance): Promise<void> {
  const botRepo = container.resolve<BotRepository>('BotRepository');

  app.put<{
    Params: { bot_id: string };
    Body: {
      appointment_booking_settings: {
        triggers?: string | null;
        instructions?: string | null;
        is_enabled: boolean;
      };
    };
  }>('/v1/bots/:bot_id/appointment_booking_settings', { preHandler: [authGuard] }, async (request, reply) => {
    const botId = Number(request.params.bot_id);
    const { triggers, instructions, is_enabled } = request.body.appointment_booking_settings;

    if (triggers && triggers.length > MAX_FIELD_LENGTH) {
      return reply.code(400).send({ error: { code: 400, message: 'triggers must not exceed 10,000 characters' } });
    }
    if (instructions && instructions.length > MAX_FIELD_LENGTH) {
      return reply.code(400).send({ error: { code: 400, message: 'instructions must not exceed 10,000 characters' } });
    }

    const bot = await botRepo.findById(botId);
    if (!bot) return reply.code(404).send({ error: { code: 404, message: 'Bot not found' } });

    const updated = await botRepo.update(botId, {
      appointmentSettings: { isEnabled: is_enabled, triggers: triggers ?? null, instructions: instructions ?? null },
    });

    const s = updated!.appointmentSettings;
    return reply.send({
      appointment_booking_settings: {
        botId,
        isEnabled: s.isEnabled,
        triggers: s.triggers ?? null,
        instructions: s.instructions ?? null,
      },
    });
  });

  app.get<{
    Params: { bot_id: string };
  }>('/v1/bots/:bot_id/appointment_booking_settings', { preHandler: [authGuard] }, async (request, reply) => {
    const botId = Number(request.params.bot_id);
    const bot = await botRepo.findById(botId);
    const s = bot?.appointmentSettings;

    return reply.send({
      appointment_booking_settings: s?.isEnabled !== undefined
        ? { botId, isEnabled: s.isEnabled, triggers: s.triggers ?? null, instructions: s.instructions ?? null }
        : null,
    });
  });
}
