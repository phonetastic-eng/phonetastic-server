import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { AppointmentBookingSettingsService } from '../services/appointment-booking-settings-service.js';
import { authGuard } from '../middleware/auth.js';

const MAX_FIELD_LENGTH = 10_000;

/**
 * Registers appointment booking settings routes on the Fastify instance.
 *
 * @precondition The DI container must have AppointmentBookingSettingsService registered.
 * @postcondition PUT and GET routes for appointment booking settings are available.
 * @param app - The Fastify application instance.
 */
export async function appointmentBookingSettingsController(app: FastifyInstance): Promise<void> {
  const service = container.resolve<AppointmentBookingSettingsService>('AppointmentBookingSettingsService');

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

    const row = await service.upsert(botId, {
      triggers: triggers ?? null,
      instructions: instructions ?? null,
      isEnabled: is_enabled,
    });

    return reply.send({ appointment_booking_settings: row });
  });

  app.get<{
    Params: { bot_id: string };
  }>('/v1/bots/:bot_id/appointment_booking_settings', { preHandler: [authGuard] }, async (request, reply) => {
    const botId = Number(request.params.bot_id);
    const row = await service.findByBotId(botId);
    return reply.send({ appointment_booking_settings: row ?? null });
  });
}
