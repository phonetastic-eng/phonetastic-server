import { AttachmentSchema, PendingAttachment, StoredAttachment, FailedAttachment } from './attachment.js';

/**
 * Transitions a pending attachment to stored state.
 *
 * @param attachment - The pending attachment to transition.
 * @param storageKey - The object-storage key where the file was written.
 * @param summary - Optional AI-generated summary of the attachment content.
 * @returns A validated stored attachment.
 * @throws {z.ZodError} If the resulting object fails schema validation.
 */
export function transitionToStored(
  attachment: PendingAttachment,
  storageKey: string,
  summary?: string | null,
): StoredAttachment {
  return AttachmentSchema.parse({
    ...attachment,
    status: 'stored',
    storageKey,
    summary: summary ?? null,
  }) as StoredAttachment;
}

/**
 * Transitions a pending attachment to failed state.
 *
 * @param attachment - The pending attachment to transition.
 * @returns A validated failed attachment.
 * @throws {z.ZodError} If the resulting object fails schema validation.
 */
export function transitionToFailed(attachment: PendingAttachment): FailedAttachment {
  return AttachmentSchema.parse({ ...attachment, status: 'failed' }) as FailedAttachment;
}
