import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { UserService } from '../services/user-service.js';
import { authGuard } from '../middleware/auth.js';

/**
 * Registers user routes on the Fastify instance.
 *
 * @precondition The DI container must have UserService and its dependencies registered.
 * @postcondition Routes POST v1/users, POST v1/users/sign_in, and PATCH v1/users/me are available.
 * @param app - The Fastify application instance.
 */
export async function userController(app: FastifyInstance): Promise<void> {
  const userService = container.resolve<UserService>('UserService');

  app.post<{
    Querystring: { expand?: string };
    Body: { user: { first_name: string; last_name?: string; phone_number: string } };
  }>('/v1/users', async (request, reply) => {
    const { user } = request.body;
    const expand = request.query.expand?.split(',') ?? [];

    const result = await userService.createUser({
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
      expand,
    });

    return reply.status(200).send(result);
  });

  app.post<{
    Querystring: { expand?: string };
    Body: { auth: { otp?: { phone_number: string; code: string }; refresh_token?: string } };
  }>('/v1/users/sign_in', async (request, reply) => {
    const { auth } = request.body;
    const expand = request.query.expand?.split(',') ?? [];

    const result = await userService.signIn({ auth, expand });

    return reply.status(200).send(result);
  });

  app.patch<{
    Body: {
      user: {
        first_name?: string;
        last_name?: string;
        call_settings?: {
          forwarded_phone_number_id?: number;
          company_phone_number_id?: number;
          is_bot_enabled?: boolean;
          rings_before_bot_answer?: number;
          answer_calls_from?: string;
        };
      };
    };
  }>('/v1/users/me', { preHandler: [authGuard] }, async (request, reply) => {
    const { user } = request.body;

    const updated = await userService.updateUser(request.userId, {
      firstName: user.first_name,
      lastName: user.last_name,
      callSettings: user.call_settings ? {
        forwardedPhoneNumberId: user.call_settings.forwarded_phone_number_id,
        companyPhoneNumberId: user.call_settings.company_phone_number_id,
        isBotEnabled: user.call_settings.is_bot_enabled,
        ringsBeforeBotAnswer: user.call_settings.rings_before_bot_answer,
        answerCallsFrom: user.call_settings.answer_calls_from as any,
      } : undefined,
    });

    return reply.status(200).send({
      user: {
        id: updated.id,
        first_name: updated.firstName,
        last_name: updated.lastName,
        phone_number_id: updated.phoneNumberId,
      },
    });
  });
}
