import { describe, it, expect } from 'vitest';
import { transitionToStored, transitionToFailed } from '../../../src/types/attachment-transitions.js';
import { PendingAttachment } from '../../../src/types/attachment.js';

const pending: PendingAttachment = {
  id: 1 as unknown as ReturnType<typeof import('../../../src/types/branded.js').AttachmentIdSchema.parse>,
  emailId: 10 as unknown as ReturnType<typeof import('../../../src/types/branded.js').EmailIdSchema.parse>,
  externalAttachmentId: null,
  filename: 'file.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024,
  createdAt: new Date(),
  status: 'pending',
  storageKey: null,
  summary: null,
};

describe('transitionToStored', () => {
  it('produces a stored attachment with storageKey and summary', () => {
    const result = transitionToStored(pending, 'bucket/key', 'A PDF about things');
    expect(result.status).toBe('stored');
    expect(result.storageKey).toBe('bucket/key');
    expect(result.summary).toBe('A PDF about things');
  });

  it('produces a stored attachment with null summary when omitted', () => {
    const result = transitionToStored(pending, 'bucket/key');
    expect(result.summary).toBeNull();
  });
});

describe('transitionToFailed', () => {
  it('produces a failed attachment', () => {
    const result = transitionToFailed(pending);
    expect(result.status).toBe('failed');
    expect(result.storageKey).toBeNull();
    expect(result.summary).toBeNull();
  });
});
