/**
 * Interface for sending SMS messages.
 * Implementations may use Twilio, AWS SNS, or other providers.
 */
export interface SmsService {
  /**
   * Sends an SMS message to the given phone number.
   *
   * @param to - E.164-formatted phone number.
   * @param body - The message body.
   */
  send(to: string, body: string): Promise<void>;
}

/**
 * Stub SMS service that records messages instead of sending them.
 * Used during development and testing.
 */
export class StubSmsService implements SmsService {
  public readonly sent: Array<{ to: string; body: string }> = [];

  async send(to: string, body: string): Promise<void> {
    this.sent.push({ to, body });
  }
}

/**
 * Structural type for a Twilio-compatible messages resource.
 */
export interface TwilioSmsClient {
  create(opts: { to: string; body: string; messagingServiceSid?: string; from?: string }): Promise<unknown>;
}

/** Sender identity: either a Messaging Service SID (production) or a From number (test/dev). */
export type TwilioSender = { messagingServiceSid: string } | { from: string };

/**
 * Twilio-backed SMS service for production and test use.
 *
 * @precondition Valid Twilio credentials and either a Messaging Service SID or a From number.
 * @postcondition The message is queued for delivery via Twilio.
 */
export class TwilioSmsService implements SmsService {
  private readonly messages: TwilioSmsClient;
  private readonly sender: TwilioSender;

  /**
   * @param messages - Twilio messages resource (client.messages).
   * @param sender - Either `{ messagingServiceSid }` for production or `{ from }` for test credentials.
   */
  constructor(messages: TwilioSmsClient, sender: TwilioSender) {
    this.messages = messages;
    this.sender = sender;
  }

  /** {@inheritDoc SmsService.send} */
  async send(to: string, body: string): Promise<void> {
    await this.messages.create({ to, body, ...this.sender });
  }
}
