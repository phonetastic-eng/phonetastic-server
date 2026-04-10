import { z } from 'zod';
import { SmsMessageIdSchema, CompanyIdSchema, PhoneNumberIdSchema } from './branded.js';

const SmsMessageBaseSchema = z.object({
  id: SmsMessageIdSchema,
  companyId: CompanyIdSchema,
  fromPhoneNumberId: PhoneNumberIdSchema,
  toPhoneNumberId: PhoneNumberIdSchema,
  body: z.string(),
  createdAt: z.date(),
});

export const ReceivedSmsMessageSchema = SmsMessageBaseSchema.extend({
  direction: z.literal('inbound'),
  state: z.literal('received'),
  externalMessageSid: z.string(),
});

export const PendingSmsMessageSchema = SmsMessageBaseSchema.extend({
  direction: z.literal('outbound'),
  state: z.literal('pending'),
  externalMessageSid: z.null(),
});

export const SentSmsMessageSchema = SmsMessageBaseSchema.extend({
  direction: z.literal('outbound'),
  state: z.literal('sent'),
  externalMessageSid: z.string(),
});

export const DeliveredSmsMessageSchema = SmsMessageBaseSchema.extend({
  direction: z.literal('outbound'),
  state: z.literal('delivered'),
  externalMessageSid: z.string(),
});

export const FailedSmsMessageSchema = SmsMessageBaseSchema.extend({
  direction: z.literal('outbound'),
  state: z.literal('failed'),
  externalMessageSid: z.string().nullable(),
});

export const SmsMessageSchema = z.discriminatedUnion('state', [
  ReceivedSmsMessageSchema,
  PendingSmsMessageSchema,
  SentSmsMessageSchema,
  DeliveredSmsMessageSchema,
  FailedSmsMessageSchema,
]);

export type SmsMessage = z.infer<typeof SmsMessageSchema>;
export type InboundSmsMessage = z.infer<typeof ReceivedSmsMessageSchema>;
export type OutboundSmsMessage =
  | z.infer<typeof PendingSmsMessageSchema>
  | z.infer<typeof SentSmsMessageSchema>
  | z.infer<typeof DeliveredSmsMessageSchema>
  | z.infer<typeof FailedSmsMessageSchema>;

export type PendingSmsMessage = z.infer<typeof PendingSmsMessageSchema>;
export type SentSmsMessage = z.infer<typeof SentSmsMessageSchema>;
export type DeliveredSmsMessage = z.infer<typeof DeliveredSmsMessageSchema>;
export type FailedSmsMessage = z.infer<typeof FailedSmsMessageSchema>;
