import { z } from 'zod';
import { CallIdSchema, CompanyIdSchema, PhoneNumberIdSchema } from './branded.js';
import { BotParticipantSchema, EndUserParticipantSchema, AgentParticipantSchema } from './call-participant.js';

const CallBaseSchema = z.object({
  id: CallIdSchema,
  externalCallId: z.string(),
  companyId: CompanyIdSchema,
  fromPhoneNumberId: PhoneNumberIdSchema,
  toPhoneNumberId: PhoneNumberIdSchema,
  testMode: z.boolean(),
  createdAt: z.date(),
});

const InboundBase = CallBaseSchema.extend({ direction: z.literal('inbound') });
const OutboundBase = CallBaseSchema.extend({ direction: z.literal('outbound') });

export const WaitingInboundCallSchema = InboundBase.extend({ state: z.literal('waiting'), failureReason: z.null() });
export const ConnectingInboundCallSchema = InboundBase.extend({ state: z.literal('connecting'), failureReason: z.null() });
export const ConnectedInboundCallSchema = InboundBase.extend({ state: z.literal('connected'), failureReason: z.null() });
export const FinishedInboundCallSchema = InboundBase.extend({ state: z.literal('finished'), failureReason: z.null() });
export const FailedInboundCallSchema = InboundBase.extend({ state: z.literal('failed'), failureReason: z.string() });

export const WaitingOutboundCallSchema = OutboundBase.extend({ state: z.literal('waiting'), failureReason: z.null() });
export const ConnectingOutboundCallSchema = OutboundBase.extend({ state: z.literal('connecting'), failureReason: z.null() });
export const ConnectedOutboundCallSchema = OutboundBase.extend({ state: z.literal('connected'), failureReason: z.null() });
export const FinishedOutboundCallSchema = OutboundBase.extend({ state: z.literal('finished'), failureReason: z.null() });
export const FailedOutboundCallSchema = OutboundBase.extend({ state: z.literal('failed'), failureReason: z.string() });

export const CallSchema = z.union([
  WaitingInboundCallSchema,
  ConnectingInboundCallSchema,
  ConnectedInboundCallSchema,
  FinishedInboundCallSchema,
  FailedInboundCallSchema,
  WaitingOutboundCallSchema,
  ConnectingOutboundCallSchema,
  ConnectedOutboundCallSchema,
  FinishedOutboundCallSchema,
  FailedOutboundCallSchema,
]);

export type Call = z.infer<typeof CallSchema>;
export type InboundCall = z.infer<
  | typeof WaitingInboundCallSchema
  | typeof ConnectingInboundCallSchema
  | typeof ConnectedInboundCallSchema
  | typeof FinishedInboundCallSchema
  | typeof FailedInboundCallSchema
>;
export type OutboundCall = z.infer<
  | typeof WaitingOutboundCallSchema
  | typeof ConnectingOutboundCallSchema
  | typeof ConnectedOutboundCallSchema
  | typeof FinishedOutboundCallSchema
  | typeof FailedOutboundCallSchema
>;
export type WaitingCall = z.infer<typeof WaitingInboundCallSchema | typeof WaitingOutboundCallSchema>;
export type ConnectingCall = z.infer<typeof ConnectingInboundCallSchema | typeof ConnectingOutboundCallSchema>;
export type ConnectedCall = z.infer<typeof ConnectedInboundCallSchema | typeof ConnectedOutboundCallSchema>;
export type FinishedCall = z.infer<typeof FinishedInboundCallSchema | typeof FinishedOutboundCallSchema>;
export type FailedCall = z.infer<typeof FailedInboundCallSchema | typeof FailedOutboundCallSchema>;

const ConnectedInboundLiveCallSchema = ConnectedInboundCallSchema.extend({ testMode: z.literal(false) });
const ConnectedInboundTestCallSchema = ConnectedInboundCallSchema.extend({ testMode: z.literal(true) });

/**
 * Zod schema for a connected inbound live (SIP) call with participants.
 * `botParticipant` and `endUserParticipant` are always present; `testMode` is `false`.
 */
export const InboundConnectedLiveCallWithParticipantsSchema = ConnectedInboundLiveCallSchema.and(
  z.object({ botParticipant: BotParticipantSchema, endUserParticipant: EndUserParticipantSchema }),
);

/**
 * Zod schema for a connected inbound test call with participants.
 * `botParticipant` and `agentParticipant` are always present; `testMode` is `true`.
 */
export const InboundConnectedTestCallWithParticipantsSchema = ConnectedInboundTestCallSchema.and(
  z.object({ botParticipant: BotParticipantSchema, agentParticipant: AgentParticipantSchema }),
);

/**
 * Zod schema for any connected inbound call with participants hydrated.
 * Discriminated on `testMode`.
 */
export const InboundConnectedCallWithParticipantsSchema = z.union([
  InboundConnectedLiveCallWithParticipantsSchema,
  InboundConnectedTestCallWithParticipantsSchema,
]);

export type InboundConnectedLiveCallWithParticipants = z.infer<typeof InboundConnectedLiveCallWithParticipantsSchema>;
export type InboundConnectedTestCallWithParticipants = z.infer<typeof InboundConnectedTestCallWithParticipantsSchema>;
export type InboundConnectedCallWithParticipants = z.infer<typeof InboundConnectedCallWithParticipantsSchema>;

/**
 * Returns true when `call` is a failed inbound call.
 *
 * @param call - Any Call value.
 * @returns `true` if direction is 'inbound' and state is 'failed'.
 */
export function isFailedInboundCall(call: Call): call is FailedCall & { direction: 'inbound' } {
  return call.direction === 'inbound' && call.state === 'failed';
}

/**
 * Returns true when `call` is a failed outbound call.
 *
 * @param call - Any Call value.
 * @returns `true` if direction is 'outbound' and state is 'failed'.
 */
export function isFailedOutboundCall(call: Call): call is FailedCall & { direction: 'outbound' } {
  return call.direction === 'outbound' && call.state === 'failed';
}

/**
 * Returns true when `call` is a connected inbound call.
 *
 * @param call - Any Call value.
 * @returns `true` if direction is 'inbound' and state is 'connected'.
 */
export function isConnectedInboundCall(call: Call): call is ConnectedCall & { direction: 'inbound' } {
  return call.direction === 'inbound' && call.state === 'connected';
}

/**
 * Returns true when `call` is a connected outbound call.
 *
 * @param call - Any Call value.
 * @returns `true` if direction is 'outbound' and state is 'connected'.
 */
export function isConnectedOutboundCall(call: Call): call is ConnectedCall & { direction: 'outbound' } {
  return call.direction === 'outbound' && call.state === 'connected';
}
