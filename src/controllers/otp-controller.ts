import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { OtpService } from '../services/otp-service.js';

/**
 * Registers OTP routes on the Fastify instance.
 *
 * @precondition The DI container must have OtpService and its dependencies registered.
 * @postcondition Routes POST v1/otps and POST v1/otps/:id/verify are available.
 * @param app - The Fastify application instance.
 */
export async function otpController(app: FastifyInstance): Promise<void> {
  const otpService = container.resolve(OtpService);

  app.post<{ Body: { otp: { phone_number: string } } }>(
    '/v1/otps',
    async (request, reply) => {
      const { phone_number } = request.body.otp;
      const result = await otpService.generateAndSend(phone_number);
      return reply.status(200).send({ otp: result });
    },
  );

  app.post<{ Params: { id: string }; Body: { otp: { password: string } } }>(
    '/v1/otps/:id/verify',
    async (request, reply) => {
      const id = Number(request.params.id);
      const { password } = request.body.otp;
      const result = await otpService.verify(id, password);
      return reply.status(200).send({ otp: result });
    },
  );
}
