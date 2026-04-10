import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import type { MetaCapiService } from '../services/meta-capi-service.js';
import { UnauthorizedError } from '../lib/errors.js';

interface CalendlyWebhookBody {
  event: string;
  payload: {
    uri: string;
    email: string;
    name: string;
    scheduled_event: {
      uri: string;
      name: string;
      start_time: string;
    };
  };
}

/**
 * Verifies a Calendly webhook signature.
 *
 * @param payload - The raw request body string.
 * @param signature - The signature from the Calendly-Webhook-Signature header.
 * @param signingKey - The webhook signing key.
 * @returns Whether the signature is valid.
 */
function verifyCalendlySignature(payload: string, signature: string, signingKey: string): boolean {
  const parts = signature.split(',');
  const timestampPart = parts.find((p) => p.startsWith('t='));
  const signaturePart = parts.find((p) => p.startsWith('v1='));
  if (!timestampPart || !signaturePart) return false;

  const timestamp = timestampPart.slice(2);
  const tolerance = 5 * 60;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > tolerance) return false;

  const expectedSig = signaturePart.slice(3);
  const signedPayload = `${timestamp}.${payload}`;
  const computed = createHmac('sha256', signingKey).update(signedPayload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Registers Calendly webhook routes on the Fastify instance.
 *
 * @precondition The DI container must have MetaCapiService registered.
 * @postcondition Route POST /v1/calendly/webhook is available.
 * @param app - The Fastify application instance.
 */
export async function calendlyWebhookController(app: FastifyInstance): Promise<void> {
  const metaCapiService = container.resolve<MetaCapiService>('MetaCapiService');
  const signingKey = container.resolve<string>('CalendlyWebhookSigningKey');

  /**
   * Handles booking events from Calendly.
   *
   * @remarks Verifies signature, filters for invitee.created, sends Schedule event to Meta CAPI.
   * @throws 401 if the webhook signature is invalid.
   */
  app.post<{ Body: CalendlyWebhookBody }>('/v1/calendly/webhook', async (request, reply) => {
    const signature = request.headers['calendly-webhook-signature'] as string;
    if (!signature) throw new UnauthorizedError('Missing webhook signature');

    if (!verifyCalendlySignature(request.rawBody as string, signature, signingKey)) {
      throw new UnauthorizedError('Invalid webhook signature');
    }

    if (request.body.event !== 'invitee.created') {
      return reply.send({});
    }

    const { email } = request.body.payload;
    const eventUri = request.body.payload.scheduled_event.uri;

    app.log.info({ email, eventUri }, 'Calendly booking received, sending Schedule event to Meta CAPI');

    await metaCapiService.sendEvent({
      eventName: 'Schedule',
      eventId: eventUri,
      email,
    });

    return reply.send({});
  });
}
