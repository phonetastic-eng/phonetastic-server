import { z } from 'zod';
import { CallIdSchema, CompanyIdSchema, BotIdSchema, UserIdSchema, EndUserIdSchema } from './branded.js';

const ParticipantBaseSchema = z.object({
  id: z.number().int().positive(),
  externalId: z.string().nullable(),
  agentId: z.number().nullable(),
  companyId: CompanyIdSchema.nullable(),
  callId: CallIdSchema,
  voiceId: z.number().nullable(),
  failureReason: z.string().nullable(),
});

const AgentBase = ParticipantBaseSchema.extend({
  type: z.literal('agent'),
  userId: UserIdSchema,
  botId: z.null(),
  endUserId: z.null(),
});

const BotBase = ParticipantBaseSchema.extend({
  type: z.literal('bot'),
  botId: BotIdSchema,
  userId: z.null(),
  endUserId: z.null(),
});

const EndUserBase = ParticipantBaseSchema.extend({
  type: z.literal('end_user'),
  endUserId: EndUserIdSchema,
  userId: z.null(),
  botId: z.null(),
});

export const WaitingAgentParticipantSchema = AgentBase.extend({ state: z.literal('waiting') });
export const ConnectingAgentParticipantSchema = AgentBase.extend({ state: z.literal('connecting') });
export const ConnectedAgentParticipantSchema = AgentBase.extend({ state: z.literal('connected') });
export const FinishedAgentParticipantSchema = AgentBase.extend({ state: z.literal('finished') });
export const FailedAgentParticipantSchema = AgentBase.extend({ state: z.literal('failed') });

export const WaitingBotParticipantSchema = BotBase.extend({ state: z.literal('waiting') });
export const ConnectingBotParticipantSchema = BotBase.extend({ state: z.literal('connecting') });
export const ConnectedBotParticipantSchema = BotBase.extend({ state: z.literal('connected') });
export const FinishedBotParticipantSchema = BotBase.extend({ state: z.literal('finished') });
export const FailedBotParticipantSchema = BotBase.extend({ state: z.literal('failed') });

export const WaitingEndUserParticipantSchema = EndUserBase.extend({ state: z.literal('waiting') });
export const ConnectingEndUserParticipantSchema = EndUserBase.extend({ state: z.literal('connecting') });
export const ConnectedEndUserParticipantSchema = EndUserBase.extend({ state: z.literal('connected') });
export const FinishedEndUserParticipantSchema = EndUserBase.extend({ state: z.literal('finished') });
export const FailedEndUserParticipantSchema = EndUserBase.extend({ state: z.literal('failed') });

export const CallParticipantSchema = z.union([
  WaitingAgentParticipantSchema,
  ConnectingAgentParticipantSchema,
  ConnectedAgentParticipantSchema,
  FinishedAgentParticipantSchema,
  FailedAgentParticipantSchema,
  WaitingBotParticipantSchema,
  ConnectingBotParticipantSchema,
  ConnectedBotParticipantSchema,
  FinishedBotParticipantSchema,
  FailedBotParticipantSchema,
  WaitingEndUserParticipantSchema,
  ConnectingEndUserParticipantSchema,
  ConnectedEndUserParticipantSchema,
  FinishedEndUserParticipantSchema,
  FailedEndUserParticipantSchema,
]);

export type CallParticipant = z.infer<typeof CallParticipantSchema>;
export type AgentCallParticipant = z.infer<
  | typeof WaitingAgentParticipantSchema
  | typeof ConnectingAgentParticipantSchema
  | typeof ConnectedAgentParticipantSchema
  | typeof FinishedAgentParticipantSchema
  | typeof FailedAgentParticipantSchema
>;
export type BotCallParticipant = z.infer<
  | typeof WaitingBotParticipantSchema
  | typeof ConnectingBotParticipantSchema
  | typeof ConnectedBotParticipantSchema
  | typeof FinishedBotParticipantSchema
  | typeof FailedBotParticipantSchema
>;
export type EndUserCallParticipant = z.infer<
  | typeof WaitingEndUserParticipantSchema
  | typeof ConnectingEndUserParticipantSchema
  | typeof ConnectedEndUserParticipantSchema
  | typeof FinishedEndUserParticipantSchema
  | typeof FailedEndUserParticipantSchema
>;
export type WaitingCallParticipant = z.infer<
  | typeof WaitingAgentParticipantSchema
  | typeof WaitingBotParticipantSchema
  | typeof WaitingEndUserParticipantSchema
>;
export type ConnectingCallParticipant = z.infer<
  | typeof ConnectingAgentParticipantSchema
  | typeof ConnectingBotParticipantSchema
  | typeof ConnectingEndUserParticipantSchema
>;
export type ConnectedCallParticipant = z.infer<
  | typeof ConnectedAgentParticipantSchema
  | typeof ConnectedBotParticipantSchema
  | typeof ConnectedEndUserParticipantSchema
>;
export type FinishedCallParticipant = z.infer<
  | typeof FinishedAgentParticipantSchema
  | typeof FinishedBotParticipantSchema
  | typeof FinishedEndUserParticipantSchema
>;
export type FailedCallParticipant = z.infer<
  | typeof FailedAgentParticipantSchema
  | typeof FailedBotParticipantSchema
  | typeof FailedEndUserParticipantSchema
>;

/**
 * Returns true when `participant` is an agent participant.
 *
 * @param participant - Any CallParticipant value.
 * @returns `true` if `participant.type === 'agent'`.
 */
export function isAgentParticipant(participant: CallParticipant): participant is AgentCallParticipant {
  return participant.type === 'agent';
}

/**
 * Returns true when `participant` is a bot participant.
 *
 * @param participant - Any CallParticipant value.
 * @returns `true` if `participant.type === 'bot'`.
 */
export function isBotParticipant(participant: CallParticipant): participant is BotCallParticipant {
  return participant.type === 'bot';
}

/**
 * Returns true when `participant` is an end_user participant.
 *
 * @param participant - Any CallParticipant value.
 * @returns `true` if `participant.type === 'end_user'`.
 */
export function isEndUserParticipant(participant: CallParticipant): participant is EndUserCallParticipant {
  return participant.type === 'end_user';
}

/**
 * Returns true when `participant` is a failed bot participant.
 *
 * @param participant - Any CallParticipant value.
 * @returns `true` if `participant.type === 'bot'` and `participant.state === 'failed'`.
 */
export function isFailedBotParticipant(participant: CallParticipant): participant is z.infer<typeof FailedBotParticipantSchema> {
  return participant.type === 'bot' && participant.state === 'failed';
}
