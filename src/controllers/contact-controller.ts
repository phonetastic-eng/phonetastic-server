import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { ContactService } from '../services/contact-service.js';
import { authGuard } from '../middleware/auth.js';

/**
 * Registers contact sync routes on the Fastify instance.
 *
 * @precondition The DI container must have ContactService registered.
 * @postcondition Route POST /v1/contacts/sync is available.
 * @param app - The Fastify application instance.
 */
export async function contactController(app: FastifyInstance): Promise<void> {
  const contactService = container.resolve<ContactService>('ContactService');

  /**
   * Syncs the authenticated user's device contacts to the server.
   * Performs a full replace: all existing contacts for the user are deleted
   * and the provided contacts are inserted.
   *
   * @param contacts - Array of device contacts with phone numbers.
   * @returns Sync confirmation.
   */
  app.post<{
    Body: {
      contacts: Array<{
        device_id: string;
        first_name?: string;
        last_name?: string;
        phone_numbers: string[];
      }>;
    };
  }>('/v1/contacts/sync', { preHandler: [authGuard] }, async (request, reply) => {
    await contactService.syncContacts(request.userId, request.body.contacts);
    return reply.status(201).send({ synced: true });
  });
}
