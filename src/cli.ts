import 'reflect-metadata';
import arg from 'arg';
import { execFileSync } from 'node:child_process';
import { setupContainer, container } from './config/container.js';
import type { CompanyRepository } from './repositories/company-repository.js';
import type { EmailAddressRepository } from './repositories/email-address-repository.js';
import type { EmailRepository } from './repositories/email-repository.js';
import type { ChatRepository } from './repositories/chat-repository.js';

/**
 * Resolves core repositories from the DI container.
 *
 * @precondition setupContainer() has been called.
 * @returns An object with companyRepo, emailAddressRepo, emailRepo, and chatRepo.
 */
export function repos() {
  return {
    companyRepo: container.resolve<CompanyRepository>('CompanyRepository'),
    emailAddressRepo: container.resolve<EmailAddressRepository>('EmailAddressRepository'),
    emailRepo: container.resolve<EmailRepository>('EmailRepository'),
    chatRepo: container.resolve<ChatRepository>('ChatRepository'),
  };
}

/**
 * Executes a gws CLI command and returns stdout as a string.
 *
 * @param args - The gws subcommand and flags.
 * @returns The stdout output.
 * @throws {Error} If gws is not installed or the command fails.
 */
export function gws(args: string[]): string {
  return execFileSync('gws', args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * Looks up a company's Phonetastic email address by company name.
 *
 * @param companyName - The company name to search for.
 * @returns The email address string.
 * @throws {Error} If company or email address is not found.
 */
export async function resolveCompanyEmail(companyName: string): Promise<string> {
  const { companyRepo, emailAddressRepo } = repos();
  const company = await companyRepo.findByName(companyName);
  if (!company) throw new Error(`Company not found: ${companyName}`);

  const addresses = await emailAddressRepo.findAllByCompanyId(company.id);
  if (addresses.length === 0) throw new Error(`No email address for company: ${companyName}`);
  return addresses[0].address;
}

/**
 * Sends a test email to a company via gws.
 *
 * @param argv - The remaining CLI arguments after the subcommand.
 */
export async function sendCommand(argv: string[]): Promise<void> {
  const args = arg({ '--company': String, '--subject': String, '--body': String, '--attach': String }, { argv });
  if (!args['--company'] || !args['--body']) {
    throw new Error('Usage: email-test send --company <name> --body <text> [--subject <text>] [--attach <file>]');
  }

  const to = await resolveCompanyEmail(args['--company']!);
  const gwsArgs = ['gmail', 'messages', 'send', '--to', to, '--subject', args['--subject'] ?? 'Test email', '--body', args['--body']!, '--format', 'json'];
  if (args['--attach']) gwsArgs.push('--attachment', args['--attach']);

  console.log(`Sending email to ${to}...`);
  console.log(gws(gwsArgs));
}

/**
 * Replies to the latest email in a chat via gws.
 *
 * @param argv - The remaining CLI arguments after the subcommand.
 */
export async function replyCommand(argv: string[]): Promise<void> {
  const args = arg({ '--chat-id': Number, '--body': String }, { argv });
  if (!args['--chat-id'] || !args['--body']) {
    throw new Error('Usage: email-test reply --chat-id <id> --body <text>');
  }

  const { emailRepo } = repos();
  const latest = await emailRepo.findLatestByChatId(args['--chat-id']!);
  if (!latest?.messageId) throw new Error(`No emails found in chat ${args['--chat-id']}`);

  console.log(`Replying to chat ${args['--chat-id']} (in-reply-to: ${latest.messageId})...`);
  console.log(gws(['gmail', 'messages', 'send', '--body', args['--body']!, '--in-reply-to', latest.messageId, '--format', 'json']));
}

/**
 * Lists recent emails via gws.
 */
export function watchCommand(): void {
  console.log('Watching for incoming emails (press Ctrl+C to stop)...');
  console.log(gws(['gmail', 'messages', 'list', '--format', 'json', '--max-results', '10']));
}

/**
 * Lists recent chats for a company using the ChatRepository.
 *
 * @param argv - The remaining CLI arguments after the subcommand.
 */
export async function chatsCommand(argv: string[]): Promise<void> {
  const args = arg({ '--company': String }, { argv });
  if (!args['--company']) throw new Error('Usage: email-test chats --company <name>');

  const { companyRepo, chatRepo } = repos();
  const company = await companyRepo.findByName(args['--company']!);
  if (!company) throw new Error(`Company not found: ${args['--company']}`);

  const rows = await chatRepo.findAllByCompanyId(company.id, { limit: 10 });
  console.log(JSON.stringify(rows.map((r) => ({
    id: r.id,
    status: r.status,
    bot_enabled: r.botEnabled,
    subject: r.subject,
    updated_at: r.updatedAt,
  })), null, 2));
}

/**
 * Prints CLI usage instructions.
 */
export function printHelp(): void {
  console.log('email-test — End-to-end email bot testing\n');
  console.log('Commands:');
  console.log('  send    --company <name> --body <text> [--subject <text>] [--attach <file>]');
  console.log('  reply   --chat-id <id> --body <text>');
  console.log('  watch   Stream recent emails');
  console.log('  chats   --company <name>  List recent chats\n');
  console.log('Prerequisites:');
  console.log('  1. Install gws: npm install -g @googleworkspace/cli');
  console.log('  2. Authenticate: gws auth login');
}

/** Command dispatch table. */
export const COMMANDS: Record<string, (argv: string[]) => void | Promise<void>> = {
  send: sendCommand,
  reply: replyCommand,
  watch: () => watchCommand(),
  chats: chatsCommand,
  help: () => printHelp(),
};

async function main(): Promise<void> {
  setupContainer();

  const command = process.argv[2] ?? 'help';
  const handler = COMMANDS[command];
  if (!handler) { printHelp(); process.exit(1); }

  try {
    await handler(process.argv.slice(3));
  } catch (err: any) {
    console.error(err.message);
    process.exit(1);
  }
  process.exit(0);
}

const isDirectExecution = process.argv[1]?.endsWith('cli.ts') || process.argv[1]?.endsWith('cli.js');
if (isDirectExecution) main();
