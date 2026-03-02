import { randomUUID } from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import { CallRepository } from '../repositories/call-repository.js';
import { CallParticipantRepository } from '../repositories/call-participant-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import { PhoneNumberRepository } from '../repositories/phone-number-repository.js';
import { BotRepository } from '../repositories/bot-repository.js';
import type { Database, Transaction } from '../db/index.js';
import type { LiveKitService } from './livekit-service.js';
import { BadRequestError } from '../lib/errors.js';

/**
 * Orchestrates call creation.
 */
@injectable()
export class CallService {
  constructor(
    @inject('Database') private db: Database,
    @inject('CallRepository') private callRepo: CallRepository,
    @inject('CallParticipantRepository') private participantRepo: CallParticipantRepository,
    @inject('UserRepository') private userRepo: UserRepository,
    @inject('PhoneNumberRepository') private phoneNumberRepo: PhoneNumberRepository,
    @inject('BotRepository') private botRepo: BotRepository,
    @inject('LiveKitService') private livekitService: LiveKitService,
  ) {}

  /**
   * Creates a test call for the authenticated user.
   *
   * @precondition The user must belong to a company, have a phone number, and have a bot.
   * @precondition `testMode` must be true; outbound calls are not yet supported.
   * @postcondition A call record with user and bot participants is persisted atomically, a LiveKit room is created, and a join token is generated.
   * @param userId - The authenticated user's id.
   * @param input - Call creation parameters.
   * @param input.testMode - Must be true. Real outbound calls are not supported.
   * @returns The created call and a LiveKit access token.
   * @throws {BadRequestError} If testMode is false, or user has no company/phone number/bot.
   */
  async createCall(userId: number, input: { testMode: boolean }) {
    if (!input.testMode) {
      throw new BadRequestError('Outbound calls are not supported');
    }

    const user = await this.userRepo.findById(userId);
    if (!user?.companyId) throw new BadRequestError('User has no company');

    const phoneNumber = await this.phoneNumberRepo.findById(user.phoneNumberId);
    if (!phoneNumber) throw new BadRequestError('User phone number not found');

    const bot = await this.botRepo.findByUserId(userId);
    if (!bot) throw new BadRequestError('Bot not found');

    const externalCallId = `test-${randomUUID()}`;

    const { call, botParticipant } = await this.db.transaction(async (tx) => {
      const created = await this.callRepo.create({
        externalCallId,
        companyId: user.companyId!,
        fromPhoneNumberId: phoneNumber.id,
        toPhoneNumberId: phoneNumber.id,
        testMode: true,
      }, tx);

      const [, botPart] = await this.createParticipants(
        created.id, userId, bot.id, user.companyId!, tx,
      );

      return { call: created, botParticipant: botPart };
    });

    await this.livekitService.createRoom(externalCallId);
    await this.livekitService.dispatchAgent(externalCallId);
    await this.participantRepo.updateState(botParticipant.id, 'connected');
    const accessToken = await this.livekitService.generateToken(externalCallId, `user-${userId}`);

    return { call, accessToken };
  }

  private async createParticipants(callId: number, userId: number, botId: number, companyId: number, tx: Transaction) {
    return Promise.all([
      this.participantRepo.create({ callId, type: 'end_user', state: 'connecting', userId, companyId }, tx),
      this.participantRepo.create({ callId, type: 'bot', state: 'waiting', botId, companyId }, tx),
    ]);
  }
}
