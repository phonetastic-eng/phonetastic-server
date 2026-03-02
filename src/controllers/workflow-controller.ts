import type { FastifyInstance } from 'fastify';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { CompanyOnboarding } from '../workflows/company-onboarding.js';
import { authGuard } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../lib/errors.js';

/**
 * Registers workflow routes on the Fastify instance.
 *
 * @precondition DBOS must be launched and the DI container initialized.
 * @postcondition Routes POST v1/workflows and GET v1/workflows/:id/status are available.
 * @param app - The Fastify application instance.
 */
export async function workflowController(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: { workflow: { type: string; params: Record<string, unknown> } };
  }>('/v1/workflows', { preHandler: [authGuard] }, async (request, reply) => {
    const { workflow } = request.body;

    if (workflow.type !== 'company_onboarding') {
      throw new BadRequestError(`Unknown workflow type: ${workflow.type}`);
    }

    const website = workflow.params.website as string;
    if (!website) throw new BadRequestError('website is required');

    const handle = await DBOS.startWorkflow(CompanyOnboarding).run(website, request.userId);
    const status = await handle.getStatus();

    return reply.status(202).send({
      workflow: {
        id: handle.workflowID,
        status: status?.status ?? 'PENDING',
        created_at: status?.createdAt ?? Date.now(),
      },
    });
  });

  app.get<{
    Params: { id: string };
  }>('/v1/workflows/:id/status', { preHandler: [authGuard] }, async (request, reply) => {
    const status = await DBOS.getWorkflowStatus(request.params.id);
    if (!status) throw new NotFoundError('Workflow not found');

    const headers: Record<string, string> = {};
    if (status.status === 'SUCCESS' && status.output) {
      const output = status.output as { companyId?: number };
      if (output.companyId) {
        headers.location = `/v1/companies/${output.companyId}`;
      }
    }

    return reply.headers(headers).send({
      workflow: {
        id: status.workflowID,
        status: status.status,
        output: status.output,
        error: status.error,
        created_at: status.createdAt,
        updated_at: status.updatedAt,
      },
    });
  });
}
