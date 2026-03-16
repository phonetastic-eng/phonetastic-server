import { DBOS, WorkflowQueue } from '@dbos-inc/dbos-sdk';
import { container } from 'tsyringe';
import type { AttachmentRepository } from '../repositories/attachment-repository.js';
import type { ChatRepository } from '../repositories/chat-repository.js';
import type { EmailRepository } from '../repositories/email-repository.js';
import { StoreAttachment } from './store-attachment.js';

export const processInboundEmailQueue = new WorkflowQueue('process-inbound-email');

/**
 * DBOS workflow that processes an inbound email: stores attachments and
 * triggers bot response (when implemented).
 */
export class ProcessInboundEmail {
  /**
   * Orchestrates inbound email processing: attachment storage, bot check, and response.
   *
   * @precondition Email and attachment rows must exist in the database.
   * @postcondition All pending attachments are stored (or marked failed). Bot response sent if enabled.
   * @param chatId - The chat id.
   * @param emailId - The email id.
   * @param companyId - The company id.
   * @param externalEmailId - The Resend email ID for attachment downloads.
   */
  @DBOS.workflow()
  static async run(chatId: number, emailId: number, companyId: number, externalEmailId: string): Promise<void> {
    await ProcessInboundEmail.processAttachments(emailId, externalEmailId, companyId);

    const chat = await ProcessInboundEmail.loadChat(chatId);
    if (!chat?.botEnabled) return;
  }

  /**
   * Step: starts child workflows to store each attachment, then marks failures.
   *
   * @param emailId - The email id.
   * @param externalEmailId - The Resend email ID.
   * @param companyId - The company id.
   */
  @DBOS.step()
  static async processAttachments(emailId: number, externalEmailId: string, companyId: number): Promise<void> {
    const attachmentRepo = container.resolve<AttachmentRepository>('AttachmentRepository');
    const attachments = await attachmentRepo.findAllByEmailId(emailId);
    const pending = attachments.filter((a) => a.status === 'pending');

    const results = await Promise.allSettled(
      pending.map(async (attachment) => {
        const handle = await DBOS.startWorkflow(StoreAttachment).run(
          attachment.id,
          externalEmailId,
          companyId,
        );
        return handle;
      }),
    );

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        await attachmentRepo.update(pending[i].id, { status: 'failed' });
      }
    }
  }

  /**
   * Step: loads a chat by id for the bot-enabled check.
   *
   * @param chatId - The chat id.
   * @returns The chat row, or undefined.
   */
  @DBOS.step()
  static async loadChat(chatId: number) {
    const chatRepo = container.resolve<ChatRepository>('ChatRepository');
    return chatRepo.findById(chatId);
  }
}
