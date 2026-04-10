import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  AttachmentSchema,
  PendingAttachmentSchema,
  StoredAttachmentSchema,
  FailedAttachmentSchema,
} from '../../../src/types/attachment.js';

const base = {
  id: 1,
  emailId: 10,
  externalAttachmentId: null,
  filename: 'file.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1024,
  createdAt: new Date(),
};

describe('PendingAttachmentSchema', () => {
  it('parses a valid pending attachment', () => {
    const result = PendingAttachmentSchema.parse({ ...base, status: 'pending', storageKey: null, summary: null });
    expect(result.status).toBe('pending');
    expect(result.storageKey).toBeNull();
    expect(result.summary).toBeNull();
  });

  it('throws when storageKey is set', () => {
    expect(() =>
      PendingAttachmentSchema.parse({ ...base, status: 'pending', storageKey: 'key', summary: null }),
    ).toThrow(z.ZodError);
  });
});

describe('StoredAttachmentSchema', () => {
  it('parses a stored attachment with summary', () => {
    const result = StoredAttachmentSchema.parse({
      ...base,
      status: 'stored',
      storageKey: 'bucket/key',
      summary: 'A PDF',
    });
    expect(result.status).toBe('stored');
    expect(result.storageKey).toBe('bucket/key');
  });

  it('parses a stored attachment with null summary', () => {
    const result = StoredAttachmentSchema.parse({ ...base, status: 'stored', storageKey: 'key', summary: null });
    expect(result.summary).toBeNull();
  });

  it('throws when storageKey is missing', () => {
    expect(() =>
      StoredAttachmentSchema.parse({ ...base, status: 'stored', storageKey: null, summary: null }),
    ).toThrow(z.ZodError);
  });
});

describe('FailedAttachmentSchema', () => {
  it('parses a valid failed attachment', () => {
    const result = FailedAttachmentSchema.parse({ ...base, status: 'failed', storageKey: null, summary: null });
    expect(result.status).toBe('failed');
  });
});

describe('AttachmentSchema discriminated union', () => {
  it('throws on unknown status', () => {
    expect(() =>
      AttachmentSchema.parse({ ...base, status: 'uploading', storageKey: null, summary: null }),
    ).toThrow(z.ZodError);
  });
});
