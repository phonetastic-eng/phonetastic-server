import { injectable, inject } from 'tsyringe';
import { eq, asc } from 'drizzle-orm';
import { botToolCalls } from '../db/schema/bot-tool-calls.js';
import type { Database, Transaction } from '../db/index.js';
import type { BotToolCall } from '../db/models.js';

/**
 * Data access layer for bot tool call records.
 */
@injectable()
export class BotToolCallRepository {
  constructor(@inject('Database') private db: Database) {}

  /**
   * Persists a new bot tool call record.
   *
   * @param data - Fields for the new tool call.
   * @param data.chatId - FK to the chat.
   * @param data.toolCallId - Unique UUID for linking input to output in history.
   * @param data.toolName - The tool that was called (e.g. 'company_info', 'reply').
   * @param data.input - The tool call arguments as JSON.
   * @param data.output - The tool execution result as JSON.
   * @param tx - Optional transaction to run within.
   * @returns The created bot tool call row.
   */
  async create(
    data: { chatId: number; toolCallId: string; toolName: string; input: unknown; output: unknown },
    tx?: Transaction,
  ): Promise<BotToolCall> {
    const [row] = await (tx ?? this.db).insert(botToolCalls).values(data).returning();
    return row;
  }

  /**
   * Finds all bot tool calls for a chat in chronological order.
   *
   * @param chatId - The chat id.
   * @returns An array of bot tool call rows ordered by created_at ascending.
   */
  async findAllByChatId(chatId: number): Promise<BotToolCall[]> {
    return this.db
      .select()
      .from(botToolCalls)
      .where(eq(botToolCalls.chatId, chatId))
      .orderBy(asc(botToolCalls.createdAt));
  }
}
