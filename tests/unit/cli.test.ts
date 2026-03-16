import { describe, it, expect, vi, beforeEach } from 'vitest';
import { container } from 'tsyringe';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn().mockReturnValue('{"ok":true}'),
}));

import { resolveCompanyEmail, chatsCommand, replyCommand, sendCommand } from '../../src/cli.js';

const companyRepo = { findByName: vi.fn() };
const emailAddressRepo = { findAllByCompanyId: vi.fn() };
const emailRepo = { findLatestByChatId: vi.fn() };
const chatRepo = { findAllByCompanyId: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(container, 'resolve').mockImplementation((token: string) => {
    const map: Record<string, unknown> = {
      CompanyRepository: companyRepo,
      EmailAddressRepository: emailAddressRepo,
      EmailRepository: emailRepo,
      ChatRepository: chatRepo,
    };
    return map[token];
  });
});

describe('resolveCompanyEmail', () => {
  it('returns the email address for a known company', async () => {
    companyRepo.findByName.mockResolvedValue({ id: 1, name: 'Acme' });
    emailAddressRepo.findAllByCompanyId.mockResolvedValue([{ address: 'acme@mail.phonetastic.ai' }]);

    const result = await resolveCompanyEmail('Acme');

    expect(result).toBe('acme@mail.phonetastic.ai');
    expect(companyRepo.findByName).toHaveBeenCalledWith('Acme');
  });

  it('throws when company is not found', async () => {
    companyRepo.findByName.mockResolvedValue(undefined);
    await expect(resolveCompanyEmail('Unknown')).rejects.toThrow('Company not found: Unknown');
  });

  it('throws when company has no email address', async () => {
    companyRepo.findByName.mockResolvedValue({ id: 1, name: 'Acme' });
    emailAddressRepo.findAllByCompanyId.mockResolvedValue([]);
    await expect(resolveCompanyEmail('Acme')).rejects.toThrow('No email address for company: Acme');
  });
});

describe('sendCommand', () => {
  it('throws when required flags are missing', async () => {
    await expect(sendCommand([])).rejects.toThrow('Usage:');
    await expect(sendCommand(['--company', 'Acme'])).rejects.toThrow('Usage:');
  });
});

describe('replyCommand', () => {
  it('throws when required flags are missing', async () => {
    await expect(replyCommand([])).rejects.toThrow('Usage:');
  });

  it('throws when no emails exist in the chat', async () => {
    emailRepo.findLatestByChatId.mockResolvedValue(undefined);
    await expect(replyCommand(['--chat-id', '42', '--body', 'hi'])).rejects.toThrow('No emails found in chat 42');
  });
});

describe('chatsCommand', () => {
  it('throws when --company flag is missing', async () => {
    await expect(chatsCommand([])).rejects.toThrow('Usage:');
  });

  it('throws when company is not found', async () => {
    companyRepo.findByName.mockResolvedValue(undefined);
    await expect(chatsCommand(['--company', 'Unknown'])).rejects.toThrow('Company not found');
  });

  it('outputs JSON for a known company', async () => {
    companyRepo.findByName.mockResolvedValue({ id: 5, name: 'Acme' });
    chatRepo.findAllByCompanyId.mockResolvedValue([
      { id: 1, status: 'open', botEnabled: true, subject: 'Test', updatedAt: new Date('2026-03-16') },
    ]);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await chatsCommand(['--company', 'Acme']);

    expect(chatRepo.findAllByCompanyId).toHaveBeenCalledWith(5, { limit: 10 });
    const output = JSON.parse(spy.mock.calls[0][0]);
    expect(output).toHaveLength(1);
    expect(output[0].id).toBe(1);

    spy.mockRestore();
  });
});
