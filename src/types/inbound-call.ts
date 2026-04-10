import { z } from 'zod';
import {
  WaitingInboundCallSchema,
  ConnectingInboundCallSchema,
  ConnectedInboundCallSchema,
  FinishedInboundCallSchema,
  FailedInboundCallSchema,
} from './call.js';
import {
  WaitingBotParticipantSchema,
  ConnectingBotParticipantSchema,
  ConnectedBotParticipantSchema,
  FinishedBotParticipantSchema,
  FailedBotParticipantSchema,
  WaitingAgentParticipantSchema,
  ConnectingAgentParticipantSchema,
  ConnectedAgentParticipantSchema,
  FinishedAgentParticipantSchema,
  FailedAgentParticipantSchema,
  WaitingEndUserParticipantSchema,
  ConnectingEndUserParticipantSchema,
  ConnectedEndUserParticipantSchema,
  FinishedEndUserParticipantSchema,
  FailedEndUserParticipantSchema,
} from './call-participant.js';
import { BotSchema } from './bot.js';
import { VoiceSchema } from './voice.js';
import { UserSchema } from './user.js';
import { EndUserSchema } from './end-user.js';
import { PhoneNumberSchema } from './phone-number.js';
import { CompanySchema } from './company.js';

const AnyBotParticipantSchema = z.union([
  WaitingBotParticipantSchema,
  ConnectingBotParticipantSchema,
  ConnectedBotParticipantSchema,
  FinishedBotParticipantSchema,
  FailedBotParticipantSchema,
]);

const AnyAgentParticipantSchema = z.union([
  WaitingAgentParticipantSchema,
  ConnectingAgentParticipantSchema,
  ConnectedAgentParticipantSchema,
  FinishedAgentParticipantSchema,
  FailedAgentParticipantSchema,
]);

const AnyEndUserParticipantSchema = z.union([
  WaitingEndUserParticipantSchema,
  ConnectingEndUserParticipantSchema,
  ConnectedEndUserParticipantSchema,
  FinishedEndUserParticipantSchema,
  FailedEndUserParticipantSchema,
]);

/** Zod schema for a bot call participant with its nested {@link Bot} and optional {@link Voice}. */
export const BotParticipantSchema = AnyBotParticipantSchema.and(
  z.object({ bot: BotSchema, voice: VoiceSchema.optional() }),
);

/** Zod schema for an end-user call participant with its nested {@link EndUser}. */
export const EndUserParticipantSchema = AnyEndUserParticipantSchema.and(
  z.object({ endUser: EndUserSchema }),
);

/** Zod schema for an agent call participant with its nested {@link User}. */
export const AgentParticipantSchema = AnyAgentParticipantSchema.and(
  z.object({ agent: UserSchema }),
);

const AnyInboundCallSchema = z.union([
  WaitingInboundCallSchema,
  ConnectingInboundCallSchema,
  ConnectedInboundCallSchema,
  FinishedInboundCallSchema,
  FailedInboundCallSchema,
]);

/**
 * Zod schema for a fully-hydrated inbound call.
 *
 * Represents the composite object returned by the call service after joining
 * the call row with its participants, phone numbers, and company. All nested
 * objects are validated at runtime.
 *
 * @remarks
 * - `botParticipant` is always present on an inbound call.
 * - `endUserParticipant` and `agentParticipant` are optional.
 * - `fromPhoneNumber` and `toPhoneNumber` may be any ownership variant.
 */
export const InboundCallSchema = AnyInboundCallSchema.and(
  z.object({
    botParticipant: BotParticipantSchema,
    endUserParticipant: EndUserParticipantSchema.optional(),
    agentParticipant: AgentParticipantSchema.optional(),
    fromPhoneNumber: PhoneNumberSchema,
    toPhoneNumber: PhoneNumberSchema,
    company: CompanySchema,
  }),
);

export type BotParticipant = z.infer<typeof BotParticipantSchema>;
export type EndUserParticipant = z.infer<typeof EndUserParticipantSchema>;
export type AgentParticipant = z.infer<typeof AgentParticipantSchema>;

/**
 * A fully-hydrated inbound call with all related entities.
 *
 * @remarks
 * This is the composite type used by the agent and call service after a
 * database join. It extends any inbound call state variant with nested
 * participants, phone numbers, and company.
 */
export type InboundCall = z.infer<typeof InboundCallSchema>;
