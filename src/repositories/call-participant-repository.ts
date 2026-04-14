import { injectable, inject } from 'tsyringe';
import { and, eq } from 'drizzle-orm';
import { callParticipants } from '../db/schema/call-participants.js';
import type { CallState, ParticipantType } from '../db/schema/enums.js';
import type { Database, Transaction } from '../db/index.js';
import { CallParticipantSchema } from '../types/index.js';
import type { CallParticipant, ConnectedBotParticipant, ConnectedEndUserParticipant, ConnectingAgentParticipant, WaitingBotParticipant } from '../types/index.js';

/**
 * Data access layer for call participants.
 */
@injectable()
export class CallParticipantRepository {
  constructor(@inject('Database') private db: Database) { }

  /**
   * Persists a new call participant record.
   *
   * @param data - The participant fields.
   * @param data.callId - The call this participant belongs to.
   * @param data.type - The participant type (agent, bot, or end_user).
   * @param data.state - The participant's initial state.
   * @param data.botId - The bot id (required when type is bot).
   * @param data.userId - The user id. Indicates a test call between the user and their bot/agent.
   * @param data.endUserId - The end user id (required when type is end_user).
   * @param data.companyId - The company id.
   * @param tx - Optional transaction to run within.
   * @returns The created participant row.
   */
  async create(data: {
    callId: number;
    type: 'end_user';
    state: 'connected';
    externalId?: string;
    botId?: number;
    userId?: number;
    endUserId?: number;
    companyId?: number;
    voiceId?: number;
  }, tx?: Transaction): Promise<ConnectedEndUserParticipant>
  async create(data: {
    callId: number;
    type: 'bot';
    state: 'connected';
    externalId?: string;
    botId?: number;
    userId?: number;
    endUserId?: number;
    companyId?: number;
    voiceId?: number;
  }, tx?: Transaction): Promise<ConnectedBotParticipant>
  async create(data: {
    callId: number;
    type: 'bot';
    state: 'waiting';
    externalId?: string;
    botId?: number;
    userId?: number;
    endUserId?: number;
    companyId?: number;
    voiceId?: number;
  }, tx?: Transaction): Promise<WaitingBotParticipant>
  async create(data: {
    callId: number;
    type: 'agent';
    state: 'connecting';
    externalId?: string;
    botId?: number;
    userId?: number;
    endUserId?: number;
    companyId?: number;
    voiceId?: number;
  }, tx?: Transaction): Promise<ConnectingAgentParticipant>
  async create(data: {
    callId: number;
    type: ParticipantType;
    state?: CallState;
    externalId?: string;
    botId?: number;
    userId?: number;
    endUserId?: number;
    companyId?: number;
    voiceId?: number;
  }, tx?: Transaction): Promise<CallParticipant> {
    const [row] = await (tx ?? this.db).insert(callParticipants).values(data).returning();
    return CallParticipantSchema.parse(row);
  }

  /**
   * Updates the state of a call participant.
   *
   * @param id - The participant id.
   * @param state - The new state.
   * @param tx - Optional transaction to run within.
   * @param failureReason - Human-readable reason for failure, if applicable.
   */
  async updateState(id: number, state: CallState, tx?: Transaction, failureReason?: string): Promise<void> {
    await (tx ?? this.db).update(callParticipants).set({ state, failureReason }).where(eq(callParticipants.id, id));
  }

  /**
   * Returns all participants for a call.
   *
   * @param callId - The call id.
   * @param tx - Optional transaction to run within.
   * @returns All participant rows for the call.
   */
  async findAllByCallId(callId: number, tx?: Transaction): Promise<CallParticipant[]> {
    const rows = await (tx ?? this.db).select().from(callParticipants).where(eq(callParticipants.callId, callId));
    return rows.map(row => CallParticipantSchema.parse(row));
  }

  /**
   * Finds the first participant of a given type for a call.
   *
   * @param callId - The call id.
   * @param type - The participant type to look up.
   * @param tx - Optional transaction to run within.
   * @returns The participant row, or undefined.
   */
  async findByCallIdAndType(callId: number, type: ParticipantType, tx?: Transaction): Promise<CallParticipant | undefined> {
    const [row] = await (tx ?? this.db)
      .select()
      .from(callParticipants)
      .where(and(eq(callParticipants.callId, callId), eq(callParticipants.type, type)));
    return row ? CallParticipantSchema.parse(row) : undefined;
  }

  /**
   * Finds a participant by call id and LiveKit external identity.
   *
   * @param callId - The call id.
   * @param externalId - The LiveKit participant identity.
   * @param tx - Optional transaction to run within.
   * @returns The participant row, or undefined.
   */
  async findByCallIdAndExternalId(callId: number, externalId: string, tx?: Transaction): Promise<CallParticipant | undefined> {
    const [row] = await (tx ?? this.db)
      .select()
      .from(callParticipants)
      .where(and(eq(callParticipants.callId, callId), eq(callParticipants.externalId, externalId)));
    return row ? CallParticipantSchema.parse(row) : undefined;
  }
}
