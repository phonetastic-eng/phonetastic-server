import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { SmsService } from '../services/sms-service.js';

/**
 * Parses an `application/x-www-form-urlencoded` body into a key-value object.
 *
 * @param raw - The raw body buffer or string.
 * @returns Decoded key-value pairs.
 */
function parseFormBody(raw: Buffer | string): Record<string, string> {
  const str = typeof raw === 'string' ? raw : raw.toString('utf-8');
  return Object.fromEntries(new URLSearchParams(str).entries());
}

/**
 * Registers Twilio webhook routes on the Fastify instance.
 *
 * @precondition The DI container must have SmsService registered.
 * @postcondition Routes POST v1/twilio/sms and POST v1/twilio/voice are available.
 * @param app - The Fastify application instance.
 */
export async function twilioWebhookController(app: FastifyInstance): Promise<void> {
  const smsService = container.resolve<SmsService>('SmsService');

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      try {
        done(null, parseFormBody(body));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  /**
   * Handles inbound SMS from Twilio. Twilio sends form-encoded bodies.
   *
   * @remarks Returns an empty TwiML response (no SMS reply by default).
   */
  app.post<{
    Body: { From?: string; To?: string; Body?: string; MessageSid?: string };
  }>('/v1/twilio/sms', async (request, reply) => {
    const { From, To, Body, MessageSid } = (request.body ?? {}) as Record<string, string | undefined>;
    if (From && To && Body && MessageSid) {
      try {
        await smsService.receiveInboundSms(From, To, Body, MessageSid);
      } catch {
        // Always return valid TwiML — Twilio requires a 200 response.
      }
    }
    return reply
      .header('content-type', 'text/xml')
      .send('<Response></Response>');
  });

  /**
   * Handles inbound voice calls from Twilio. Returns TwiML that plays a
   * greeting while the LiveKit agent connects via SIP.
   *
   * @remarks Point your Twilio phone number's Voice webhook to this URL.
   */
  app.post('/v1/twilio/voice', async (_request, reply) => {
    const twiml = [
      '<Response>',
      '  <Say>Thank you for calling. Please hold while we connect you.</Say>',
      '</Response>',
    ].join('\n');
    return reply.header('content-type', 'text/xml').send(twiml);
  });
}
