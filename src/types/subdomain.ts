import { z } from 'zod';
import { CompanyIdSchema } from './branded.js';

const SubdomainBaseSchema = z.object({
  id: z.number().int().positive(),
  companyId: CompanyIdSchema,
  subdomain: z.string(),
  createdAt: z.date(),
});

export const NotStartedSubdomainSchema = SubdomainBaseSchema.extend({
  status: z.literal('not_started'),
  resendDomainId: z.null(),
});

export const PendingSubdomainSchema = SubdomainBaseSchema.extend({
  status: z.literal('pending'),
  resendDomainId: z.string(),
});

export const VerifiedSubdomainSchema = SubdomainBaseSchema.extend({
  status: z.literal('verified'),
  resendDomainId: z.string(),
});

export const PartiallyVerifiedSubdomainSchema = SubdomainBaseSchema.extend({
  status: z.literal('partially_verified'),
  resendDomainId: z.string(),
});

export const PartiallyFailedSubdomainSchema = SubdomainBaseSchema.extend({
  status: z.literal('partially_failed'),
  resendDomainId: z.string().nullable(),
});

export const FailedSubdomainSchema = SubdomainBaseSchema.extend({
  status: z.literal('failed'),
  resendDomainId: z.string().nullable(),
});

export const TemporaryFailureSubdomainSchema = SubdomainBaseSchema.extend({
  status: z.literal('temporary_failure'),
  resendDomainId: z.string().nullable(),
});

export const SubdomainSchema = z.discriminatedUnion('status', [
  NotStartedSubdomainSchema,
  PendingSubdomainSchema,
  VerifiedSubdomainSchema,
  PartiallyVerifiedSubdomainSchema,
  PartiallyFailedSubdomainSchema,
  FailedSubdomainSchema,
  TemporaryFailureSubdomainSchema,
]);

export type Subdomain = z.infer<typeof SubdomainSchema>;
