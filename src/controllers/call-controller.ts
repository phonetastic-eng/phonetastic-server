import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { CallService } from '../services/call-service.js';
import { authGuard } from '../middleware/auth.js';

/**
 * Registers call routes on the Fastify instance.
 *
 * @precondition The DI container must have CallService registered.
 * @postcondition Route POST v1/calls is available.
 * @param app - The Fastify application instance.
 */
export async function callController(app: FastifyInstance): Promise<void> {
  const callService = container.resolve<CallService>('CallService');

  app.post<{
    Body: { call: { test_mode?: boolean } };
  }>('/v1/calls', { preHandler: [authGuard] }, async (request, reply) => {
    const { call: created, accessToken } = await callService.createCall(
      request.userId,
      { testMode: request.body.call.test_mode ?? false },
    );

    return reply.status(201).send({
      call: {
        id: created.id,
        external_call_id: created.externalCallId,
        state: created.state,
        test_mode: created.testMode,
        created_at: created.createdAt,
      },
      auth: { access_token: accessToken },
    });
  });
}
