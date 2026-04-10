import { z } from 'zod';
import { AttachmentIdSchema, EmailIdSchema } from './branded.js';

const AttachmentBaseSchema = z.object({
  id: AttachmentIdSchema,
  emailId: EmailIdSchema,
  externalAttachmentId: z.string().nullable(),
  filename: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().nullable(),
  createdAt: z.date(),
});

export const PendingAttachmentSchema = AttachmentBaseSchema.extend({
  status: z.literal('pending'),
  storageKey: z.null(),
  summary: z.null(),
});

export const StoredAttachmentSchema = AttachmentBaseSchema.extend({
  status: z.literal('stored'),
  storageKey: z.string(),
  summary: z.string().nullable(),
});

export const FailedAttachmentSchema = AttachmentBaseSchema.extend({
  status: z.literal('failed'),
  storageKey: z.null(),
  summary: z.null(),
});

export const AttachmentSchema = z.discriminatedUnion('status', [
  PendingAttachmentSchema,
  StoredAttachmentSchema,
  FailedAttachmentSchema,
]);

export type Attachment = z.infer<typeof AttachmentSchema>;
export type PendingAttachment = z.infer<typeof PendingAttachmentSchema>;
export type StoredAttachment = z.infer<typeof StoredAttachmentSchema>;
export type FailedAttachment = z.infer<typeof FailedAttachmentSchema>;
