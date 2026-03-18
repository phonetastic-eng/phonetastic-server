import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDbos = vi.hoisted(() => ({
  DBOS: {
    step: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
    workflow: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
    transaction: () => (_t: unknown, _k: string, d: PropertyDescriptor) => d,
    startWorkflow: vi.fn(),
    drizzleClient: { update: vi.fn() },
  },
  WorkflowQueue: vi.fn(),
}));
vi.mock('@dbos-inc/dbos-sdk', () => mockDbos);

const mockContainer = vi.hoisted(() => ({
  container: { resolve: vi.fn() },
}));
vi.mock('tsyringe', () => mockContainer);

import { SendOwnerEmail } from '../../../src/workflows/send-owner-email.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SendOwnerEmail.loadContext', () => {
  const setupRepos = (overrides: {
    email?: unknown;
    chat?: unknown;
    emailAddress?: unknown;
    endUser?: unknown;
    allEmails?: unknown[];
  }) => {
    const emailRepo = {
      findById: vi.fn().mockResolvedValue(overrides.email),
      findAllByChatId: vi.fn().mockResolvedValue(overrides.allEmails ?? []),
    };
    const chatRepo = { findById: vi.fn().mockResolvedValue(overrides.chat) };
    const emailAddressRepo = { findById: vi.fn().mockResolvedValue(overrides.emailAddress) };
    const endUserRepo = { findById: vi.fn().mockResolvedValue(overrides.endUser) };

    mockContainer.container.resolve
      .mockReturnValueOnce(emailRepo)
      .mockReturnValueOnce(chatRepo)
      .mockReturnValueOnce(emailAddressRepo)
      .mockReturnValueOnce(endUserRepo);

    return { emailRepo, chatRepo, emailAddressRepo, endUserRepo };
  };

  it('returns null when email not found', async () => {
    setupRepos({ email: undefined });

    expect(await SendOwnerEmail.loadContext(999)).toBeNull();
  });

  it('returns null when chat not found', async () => {
    setupRepos({ email: { id: 1, chatId: 10 }, chat: undefined });

    expect(await SendOwnerEmail.loadContext(1)).toBeNull();
  });

  it('returns null when end user has no email', async () => {
    setupRepos({
      email: { id: 1, chatId: 10, bodyText: 'Hi' },
      chat: { id: 10, endUserId: 2, emailAddressId: null, subject: 'Test' },
      endUser: { id: 2, email: null },
    });

    expect(await SendOwnerEmail.loadContext(1)).toBeNull();
  });

  it('returns context with replyTo set to company email address', async () => {
    setupRepos({
      email: { id: 1, chatId: 10, bodyText: 'Thanks for reaching out' },
      chat: { id: 10, endUserId: 2, emailAddressId: 5, subject: 'Billing Question' },
      emailAddress: { id: 5, address: 'support@acme.com' },
      endUser: { id: 2, email: 'customer@example.com' },
      allEmails: [{ messageId: '<prev@mail.com>', referenceIds: ['<ref1>'] }],
    });

    const ctx = await SendOwnerEmail.loadContext(1);

    expect(ctx).toMatchObject({
      chatId: 10,
      from: 'support@acme.com',
      to: 'customer@example.com',
      replyTo: 'support@acme.com',
      subject: 'Billing Question',
      text: 'Thanks for reaching out',
      inReplyTo: '<prev@mail.com>',
      references: ['<ref1>'],
      emailCount: 1,
    });
  });

  it('falls back to noreply address when no email address configured', async () => {
    setupRepos({
      email: { id: 1, chatId: 10, bodyText: 'Reply' },
      chat: { id: 10, endUserId: 2, emailAddressId: null, subject: null },
      endUser: { id: 2, email: 'user@test.com' },
      allEmails: [],
    });

    const ctx = await SendOwnerEmail.loadContext(1);

    expect(ctx!.from).toBe('noreply@mail.phonetastic.ai');
    expect(ctx!.replyTo).toBe('noreply@mail.phonetastic.ai');
    expect(ctx!.subject).toBe('Re: Your inquiry');
  });
});

describe('SendOwnerEmail.sendViaResend', () => {
  it('passes replyTo to the resend service', async () => {
    const mockResend = {
      sendEmail: vi.fn().mockResolvedValue({ id: 'r-1', messageId: '<msg@r.dev>' }),
    };
    mockContainer.container.resolve.mockReturnValue(mockResend);

    await SendOwnerEmail.sendViaResend({
      from: 'support@acme.com',
      to: 'user@test.com',
      replyTo: 'support@acme.com',
      subject: 'Re: Help',
      text: 'Here is your answer',
    });

    expect(mockResend.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'support@acme.com' }),
    );
  });
});

describe('SendOwnerEmail.markSent', () => {
  it('delegates to EmailRepository.markSent', async () => {
    const mockEmailRepo = { markSent: vi.fn().mockResolvedValue(undefined) };
    mockContainer.container.resolve.mockReturnValue(mockEmailRepo);

    await SendOwnerEmail.markSent(42, '<msg-42@mail.com>');

    expect(mockEmailRepo.markSent).toHaveBeenCalledWith(42, '<msg-42@mail.com>');
  });
});

describe('SendOwnerEmail.run', () => {
  it('does not send when loadContext returns null', async () => {
    const emailRepo = { findById: vi.fn().mockResolvedValue(undefined) };
    mockContainer.container.resolve.mockReturnValue(emailRepo);

    await SendOwnerEmail.run(999);

    expect(mockDbos.DBOS.startWorkflow).not.toHaveBeenCalled();
  });

  it('triggers UpdateChatSummary when emailCount > 2', async () => {
    const mockResend = {
      sendEmail: vi.fn().mockResolvedValue({ id: 'r-1', messageId: '<msg@r.dev>' }),
    };
    const mockEmailRepo = {
      findById: vi.fn().mockResolvedValue({ id: 1, chatId: 10, bodyText: 'Reply' }),
      findAllByChatId: vi.fn().mockResolvedValue([{}, {}, {}]),
      markSent: vi.fn(),
    };
    const mockChatRepo = { findById: vi.fn().mockResolvedValue({ id: 10, endUserId: 2, emailAddressId: null, subject: 'Q' }) };
    const mockEmailAddrRepo = { findById: vi.fn() };
    const mockEndUserRepo = { findById: vi.fn().mockResolvedValue({ id: 2, email: 'u@t.com' }) };

    mockContainer.container.resolve
      .mockReturnValueOnce(mockEmailRepo)
      .mockReturnValueOnce(mockChatRepo)
      .mockReturnValueOnce(mockEmailAddrRepo)
      .mockReturnValueOnce(mockEndUserRepo)
      .mockReturnValueOnce(mockResend)
      .mockReturnValueOnce(mockEmailRepo);

    mockDbos.DBOS.startWorkflow.mockReturnValue({ run: vi.fn() });

    await SendOwnerEmail.run(1);

    expect(mockDbos.DBOS.startWorkflow).toHaveBeenCalled();
  });

  it('skips UpdateChatSummary when emailCount <= 2', async () => {
    const mockResend = {
      sendEmail: vi.fn().mockResolvedValue({ id: 'r-1', messageId: '<msg@r.dev>' }),
    };
    const mockEmailRepo = {
      findById: vi.fn().mockResolvedValue({ id: 1, chatId: 10, bodyText: 'Reply' }),
      findAllByChatId: vi.fn().mockResolvedValue([{}]),
      markSent: vi.fn(),
    };
    const mockChatRepo = { findById: vi.fn().mockResolvedValue({ id: 10, endUserId: 2, emailAddressId: null, subject: 'Q' }) };
    const mockEmailAddrRepo = { findById: vi.fn() };
    const mockEndUserRepo = { findById: vi.fn().mockResolvedValue({ id: 2, email: 'u@t.com' }) };

    mockContainer.container.resolve
      .mockReturnValueOnce(mockEmailRepo)
      .mockReturnValueOnce(mockChatRepo)
      .mockReturnValueOnce(mockEmailAddrRepo)
      .mockReturnValueOnce(mockEndUserRepo)
      .mockReturnValueOnce(mockResend)
      .mockReturnValueOnce(mockEmailRepo);

    await SendOwnerEmail.run(1);

    expect(mockDbos.DBOS.startWorkflow).not.toHaveBeenCalled();
  });
});
