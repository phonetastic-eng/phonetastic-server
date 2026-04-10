import { z } from 'zod';
import { toE164 } from '../lib/phone.js';

export const CompanyIdSchema = z.number().int().positive().brand<'CompanyId'>();
export type CompanyId = z.infer<typeof CompanyIdSchema>;

export const UserIdSchema = z.number().int().positive().brand<'UserId'>();
export type UserId = z.infer<typeof UserIdSchema>;

export const BotIdSchema = z.number().int().positive().brand<'BotId'>();
export type BotId = z.infer<typeof BotIdSchema>;

export const EndUserIdSchema = z.number().int().positive().brand<'EndUserId'>();
export type EndUserId = z.infer<typeof EndUserIdSchema>;

export const ContactIdSchema = z.number().int().positive().brand<'ContactId'>();
export type ContactId = z.infer<typeof ContactIdSchema>;

export const CallIdSchema = z.number().int().positive().brand<'CallId'>();
export type CallId = z.infer<typeof CallIdSchema>;

export const PhoneNumberIdSchema = z.number().int().positive().brand<'PhoneNumberId'>();
export type PhoneNumberId = z.infer<typeof PhoneNumberIdSchema>;

export const SmsMessageIdSchema = z.number().int().positive().brand<'SmsMessageId'>();
export type SmsMessageId = z.infer<typeof SmsMessageIdSchema>;

export const EmailIdSchema = z.number().int().positive().brand<'EmailId'>();
export type EmailId = z.infer<typeof EmailIdSchema>;

export const ChatIdSchema = z.number().int().positive().brand<'ChatId'>();
export type ChatId = z.infer<typeof ChatIdSchema>;

export const VoiceIdSchema = z.number().int().positive().brand<'VoiceId'>();
export type VoiceId = z.infer<typeof VoiceIdSchema>;

export const SkillIdSchema = z.number().int().positive().brand<'SkillId'>();
export type SkillId = z.infer<typeof SkillIdSchema>;

export const AttachmentIdSchema = z.number().int().positive().brand<'AttachmentId'>();
export type AttachmentId = z.infer<typeof AttachmentIdSchema>;

export const E164Schema = z.string().regex(/^\+[0-9]{2,14}$/).brand<'E164'>();
export type E164 = z.infer<typeof E164Schema>;

/**
 * Normalises a raw phone number string to E.164 and validates it.
 *
 * @param raw - Any phone number string accepted by `google-libphonenumber`.
 * @returns The E.164-branded string (e.g. `"+14155552671"`).
 * @throws {Error} If `raw` cannot be parsed as a valid phone number.
 * @throws {z.ZodError} If the normalised result does not match the E.164 pattern.
 */
export function parseE164(raw: string): E164 {
  return E164Schema.parse(toE164(raw));
}

export const ExternalCallIdSchema = z.string().brand<'ExternalCallId'>();
export type ExternalCallId = z.infer<typeof ExternalCallIdSchema>;

export const TwilioMessageSidSchema = z
  .string()
  .regex(/^SM[0-9a-f]{32}$/)
  .brand<'TwilioMessageSid'>();
export type TwilioMessageSid = z.infer<typeof TwilioMessageSidSchema>;

export const SipDispatchRuleIdSchema = z.string().brand<'SipDispatchRuleId'>();
export type SipDispatchRuleId = z.infer<typeof SipDispatchRuleIdSchema>;
