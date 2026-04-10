import {
  SmsMessageSchema,
  PendingSmsMessage,
  SentSmsMessage,
  DeliveredSmsMessage,
  FailedSmsMessage,
} from './sms-message.js';

/**
 * Transitions a pending outbound SMS to sent state.
 *
 * @param msg - The pending SMS message to transition.
 * @param externalMessageSid - The Twilio message SID assigned on send.
 * @returns A validated sent SMS message.
 * @throws {z.ZodError} If the resulting object fails schema validation.
 */
export function transitionToSent(msg: PendingSmsMessage, externalMessageSid: string): SentSmsMessage {
  return SmsMessageSchema.parse({ ...msg, state: 'sent', externalMessageSid }) as SentSmsMessage;
}

/**
 * Transitions a sent outbound SMS to delivered state.
 *
 * @param msg - The sent SMS message to transition.
 * @returns A validated delivered SMS message.
 * @throws {z.ZodError} If the resulting object fails schema validation.
 */
export function transitionToDelivered(msg: SentSmsMessage): DeliveredSmsMessage {
  return SmsMessageSchema.parse({ ...msg, state: 'delivered' }) as DeliveredSmsMessage;
}

/**
 * Transitions a pending or sent outbound SMS to failed state.
 *
 * @param msg - The pending or sent SMS message to transition.
 * @param externalMessageSid - Optional Twilio message SID; may be null if unavailable.
 * @returns A validated failed SMS message.
 * @throws {z.ZodError} If the resulting object fails schema validation.
 */
export function transitionToFailed(
  msg: PendingSmsMessage | SentSmsMessage,
  externalMessageSid?: string | null,
): FailedSmsMessage {
  const sid = externalMessageSid !== undefined ? externalMessageSid : msg.externalMessageSid ?? null;
  return SmsMessageSchema.parse({ ...msg, state: 'failed', externalMessageSid: sid }) as FailedSmsMessage;
}
