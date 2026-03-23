import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { BotRepository } from '../repositories/bot-repository.js';
import { authGuard } from '../middleware/auth.js';
import { NotFoundError } from '../lib/errors.js';

/**
 * Registers bot routes on the Fastify instance.
 *
 * @precondition The DI container must have BotRepository registered.
 * @postcondition Route PATCH /v1/bots/:id is available.
 * @param app - The Fastify application instance.
 */
export async function botController(app: FastifyInstance): Promise<void> {
  const botRepo = container.resolve<BotRepository>('BotRepository');

  app.patch<{
    Params: { id: string };
    Body: { bot: { phone_number_id?: number | null } };
  }>('/v1/bots/:id', { preHandler: [authGuard] }, async (request, reply) => {
    const botId = Number(request.params.id);
    const existing = await botRepo.findById(botId);
    if (!existing) throw new NotFoundError('Bot not found');

    const { bot } = request.body;
    const updated = await botRepo.update(botId, {
      phoneNumberId: bot.phone_number_id,
    });

    return reply.send({
      bot: {
        id: updated!.id,
        user_id: updated!.userId,
        name: updated!.name,
        phone_number_id: updated!.phoneNumberId,
      },
    });
  });
}
