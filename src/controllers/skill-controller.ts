import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { SkillRepository } from '../repositories/skill-repository.js';
import { authGuard } from '../middleware/auth.js';

/**
 * Registers skill routes on the Fastify instance.
 *
 * @precondition The DI container must have SkillRepository registered.
 * @postcondition Route GET v1/skills is available with page_token pagination.
 * @param app - The Fastify application instance.
 */
export async function skillController(app: FastifyInstance): Promise<void> {
  const skillRepo = container.resolve<SkillRepository>('SkillRepository');

  app.get<{
    Querystring: { page_token?: string; limit?: string };
  }>('/v1/skills', { preHandler: [authGuard] }, async (request, reply) => {
    const pageToken = request.query.page_token ? Number(request.query.page_token) : undefined;
    const limit = request.query.limit ? Number(request.query.limit) : undefined;

    const rows = await skillRepo.findAll({ pageToken, limit });
    const nextPageToken = rows.length > 0 ? rows[rows.length - 1].id : null;

    return reply.send({ skills: rows, page_token: nextPageToken });
  });
}
