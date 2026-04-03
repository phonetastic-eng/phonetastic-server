import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CallService } from '../../../src/services/call-service.js';
import { BadRequestError } from '../../../src/lib/errors.js';

const mockEnqueue = vi.fn().mockResolvedValue(undefined);
const mockDbosClientFactory = { getInstance: vi.fn().mockResolvedValue({ enqueue: mockEnqueue }) };

describe('CallService', () => {
  let db: any;
  let callRepo: any;
  let participantRepo: any;
  let transcriptRepo: any;
  let transcriptEntryRepo: any;
  let userRepo: any;
  let phoneNumberRepo: any;
  let botRepo: any;
  let voiceRepo: any;
  let livekitService: any;
  let endUserRepo: any;
  let contactService: any;
  let service: CallService;

  beforeEach(() => {
    db = { transaction: vi.fn().mockImplementation(async (cb: any) => cb({})) };
    callRepo = { create: vi.fn(), findByExternalCallId: vi.fn(), findByExternalCallIdWithParticipants: vi.fn(), updateState: vi.fn().mockResolvedValue(undefined), findAllByCompanyId: vi.fn() };
    participantRepo = { create: vi.fn(), updateState: vi.fn().mockResolvedValue(undefined), findByCallIdAndType: vi.fn(), findAllByCallId: vi.fn(), findByCallIdAndExternalId: vi.fn() };
    transcriptRepo = { create: vi.fn().mockResolvedValue({ id: 1 }), findByCallId: vi.fn() };
    transcriptEntryRepo = { create: vi.fn().mockResolvedValue(undefined), findAllByTranscriptId: vi.fn() };
    userRepo = { findById: vi.fn(), findByCompanyId: vi.fn(), findByPhoneNumberId: vi.fn() };
    phoneNumberRepo = { findById: vi.fn(), findByE164: vi.fn(), create: vi.fn(), findE164ByIds: vi.fn().mockResolvedValue(new Map()) };
    botRepo = { findByUserId: vi.fn(), findByPhoneNumberId: vi.fn() };
    voiceRepo = { findByBotId: vi.fn().mockResolvedValue({ id: 42, provider: 'phonic', externalId: 'sabrina' }), findFirstByProvider: vi.fn() };
    livekitService = {
      createRoom: vi.fn().mockResolvedValue('room-id'),
      generateToken: vi.fn().mockResolvedValue('access-token'),
      dispatchAgent: vi.fn().mockResolvedValue(undefined),
      deleteRoom: vi.fn().mockResolvedValue(undefined),
    };
    endUserRepo = { findByPhoneNumberId: vi.fn(), create: vi.fn(), updateFromContact: vi.fn(), findNamesByCallIds: vi.fn().mockResolvedValue(new Map()) };
    contactService = { resolveContact: vi.fn(), syncContacts: vi.fn() };
    mockEnqueue.mockClear();
    mockDbosClientFactory.getInstance.mockClear();
    service = new CallService(db, callRepo, participantRepo, transcriptRepo, transcriptEntryRepo, userRepo, phoneNumberRepo, botRepo, voiceRepo, livekitService, endUserRepo, contactService, mockDbosClientFactory as any);
  });

  describe('createCall', () => {
    it('throws BadRequestError when testMode is false', async () => {
      await expect(service.createCall(1, { testMode: false })).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when user has no company', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: null, phoneNumberId: 1 });
      await expect(service.createCall(1, { testMode: true })).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when phone number is not found', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5, phoneNumberId: 1 });
      phoneNumberRepo.findById.mockResolvedValue(null);
      await expect(service.createCall(1, { testMode: true })).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when bot is not found', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5, phoneNumberId: 1 });
      phoneNumberRepo.findById.mockResolvedValue({ id: 1 });
      botRepo.findByUserId.mockResolvedValue(null);
      await expect(service.createCall(1, { testMode: true })).rejects.toThrow(BadRequestError);
    });

    it('creates a call, dispatches the agent, and returns a LiveKit access token', async () => {
      const call = { id: 99, externalCallId: 'test-abc', state: 'connecting', testMode: true };
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5, phoneNumberId: 1 });
      phoneNumberRepo.findById.mockResolvedValue({ id: 1 });
      botRepo.findByUserId.mockResolvedValue({ id: 2 });
      callRepo.create.mockResolvedValue(call);
      participantRepo.create.mockResolvedValue({ id: 10 });

      const result = await service.createCall(1, { testMode: true });

      expect(result.call.id).toBe(99);
      expect(result.accessToken).toBe('access-token');
      expect(livekitService.createRoom).toHaveBeenCalledOnce();
      expect(livekitService.dispatchAgent).toHaveBeenCalledWith(expect.stringMatching(/^test-/));
      expect(participantRepo.updateState).toHaveBeenCalledWith(10, 'connected');
      expect(livekitService.generateToken).toHaveBeenCalledWith(expect.stringMatching(/^test-/), 'user-1');
      expect(participantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'agent', externalId: 'user-1' }), expect.anything());
      expect(participantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'bot', voiceId: 42 }), expect.anything());
    });

    it('falls back to default provider when bot has no voice configured', async () => {
      const call = { id: 99, externalCallId: 'test-abc', state: 'connecting', testMode: true };
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5, phoneNumberId: 1 });
      phoneNumberRepo.findById.mockResolvedValue({ id: 1 });
      botRepo.findByUserId.mockResolvedValue({ id: 2 });
      voiceRepo.findByBotId.mockResolvedValue(null);
      voiceRepo.findFirstByProvider.mockResolvedValue({ id: 99, provider: 'openai' });
      callRepo.create.mockResolvedValue(call);
      participantRepo.create.mockResolvedValue({ id: 10 });

      await service.createCall(1, { testMode: true });

      expect(participantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'bot', voiceId: 99 }), expect.anything());
    });
  });

  describe('startInboundCall', () => {
    const req = { externalCallId: 'room-1', fromE164: '+15005550100', toE164: '+15005550200', callerIdentity: 'sip_abc' };

    it('throws BadRequestError when no phone number record exists for destination', async () => {
      phoneNumberRepo.findByE164.mockResolvedValue(null);
      await expect(service.startInboundCall(req)).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when no bot is associated with the destination phone number', async () => {
      phoneNumberRepo.findByE164.mockResolvedValue({ id: 10, companyId: 5 });
      botRepo.findByPhoneNumberId.mockResolvedValue(null);
      await expect(service.startInboundCall({ ...req, fromE164: '+1111', toE164: '+2222' })).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when bot owner has no company', async () => {
      phoneNumberRepo.findByE164.mockResolvedValue({ id: 10, companyId: 5 });
      botRepo.findByPhoneNumberId.mockResolvedValue({ id: 7, userId: 3 });
      userRepo.findById.mockResolvedValue({ id: 3, companyId: null });
      await expect(service.startInboundCall({ ...req, fromE164: '+1111', toE164: '+2222' })).rejects.toThrow(BadRequestError);
    });

    it('creates call and both participants as connected in a transaction', async () => {
      const fromPhoneNumber = { id: 55, phoneNumberE164: '+15005550100' };
      const toPhoneNumber = { id: 10, phoneNumberE164: '+15005550200' };
      const endUser = { id: 20, phoneNumberId: 55, companyId: 5 };
      const botParticipant = { id: 2, callId: 42, type: 'bot', botId: 7, state: 'connected', companyId: 5, voiceId: 42 };
      const endUserParticipant = { id: 3, callId: 42, type: 'end_user', endUserId: 20, state: 'connected', companyId: 5 };
      const voice = { id: 42, provider: 'phonic', externalId: 'sabrina' };

      phoneNumberRepo.findByE164.mockResolvedValueOnce(toPhoneNumber).mockResolvedValueOnce(fromPhoneNumber);
      botRepo.findByPhoneNumberId.mockResolvedValue({ id: 7, userId: 3 });
      userRepo.findById.mockResolvedValue({ id: 3, companyId: 5 });
      voiceRepo.findByBotId.mockResolvedValue(voice);
      endUserRepo.findByPhoneNumberId.mockResolvedValue(endUser);
      callRepo.create.mockResolvedValue({ id: 42, companyId: 5, externalCallId: 'room-1' });
      participantRepo.create.mockResolvedValueOnce(botParticipant).mockResolvedValueOnce(endUserParticipant);

      const result = await service.startInboundCall(req);

      expect(db.transaction).toHaveBeenCalledOnce();
      expect(callRepo.create).toHaveBeenCalledWith(expect.objectContaining({ state: 'connected', externalCallId: 'room-1' }), expect.anything());
      expect(participantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'bot', voiceId: 42, state: 'connected' }), expect.anything());
      expect(transcriptRepo.create).toHaveBeenCalledWith({ callId: 42 }, expect.anything());
      expect(participantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'end_user', state: 'connected', endUserId: 20, externalId: 'sip_abc' }), expect.anything());
      expect(callRepo.findByExternalCallIdWithParticipants).not.toHaveBeenCalled();
      expect(result.botParticipant).toEqual({ ...botParticipant, voice, bot: expect.objectContaining({ id: 7 }) });
      expect(result.endUserParticipant).toEqual({ ...endUserParticipant, endUser });
      expect(result.fromPhoneNumber).toEqual(fromPhoneNumber);
      expect(result.toPhoneNumber).toEqual(toPhoneNumber);
    });

    it('creates the from phone number and end user when they do not exist', async () => {
      const toPhoneNumber = { id: 10, phoneNumberE164: '+15005550200' };
      const newFromPhoneNumber = { id: 11, phoneNumberE164: '+15005550100' };
      const newEndUser = { id: 21, phoneNumberId: 11, companyId: 9 };

      phoneNumberRepo.findByE164.mockResolvedValueOnce(toPhoneNumber).mockResolvedValueOnce(undefined);
      phoneNumberRepo.create.mockResolvedValue(newFromPhoneNumber);
      botRepo.findByPhoneNumberId.mockResolvedValue({ id: 7, userId: 3 });
      userRepo.findById.mockResolvedValue({ id: 3, companyId: 9 });
      endUserRepo.findByPhoneNumberId.mockResolvedValue(undefined);
      endUserRepo.create.mockResolvedValue(newEndUser);
      callRepo.create.mockResolvedValue({ id: 42, companyId: 9, externalCallId: 'room-1' });
      participantRepo.create.mockResolvedValue({ id: 1, type: 'bot', botId: 7 });

      await service.startInboundCall(req);

      expect(phoneNumberRepo.create).toHaveBeenCalledWith({ phoneNumberE164: '+15005550100' }, expect.anything());
      expect(endUserRepo.create).toHaveBeenCalledWith({ phoneNumberId: 11, companyId: 9 }, expect.anything());
      expect(participantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'end_user', endUserId: 21 }), expect.anything());
    });

    it('falls back to default provider voice when bot has no voice configured', async () => {
      const toPhoneNumber = { id: 10, phoneNumberE164: '+15005550200' };
      const fromPhoneNumber = { id: 55, phoneNumberE164: '+15005550100' };
      const defaultVoice = { id: 99, provider: 'openai', externalId: 'alloy' };

      phoneNumberRepo.findByE164.mockResolvedValueOnce(toPhoneNumber).mockResolvedValueOnce(fromPhoneNumber);
      botRepo.findByPhoneNumberId.mockResolvedValue({ id: 7, userId: 3 });
      userRepo.findById.mockResolvedValue({ id: 3, companyId: 5 });
      voiceRepo.findByBotId.mockResolvedValue(null);
      voiceRepo.findFirstByProvider.mockResolvedValue(defaultVoice);
      endUserRepo.findByPhoneNumberId.mockResolvedValue({ id: 20, phoneNumberId: 55, companyId: 5 });
      callRepo.create.mockResolvedValue({ id: 42, companyId: 5, externalCallId: 'room-1' });
      participantRepo.create.mockResolvedValue({ id: 1, type: 'bot', botId: 7 });

      const result = await service.startInboundCall(req);

      expect(participantRepo.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'bot', voiceId: 99 }), expect.anything());
      expect(result.botParticipant.voice).toEqual(defaultVoice);
    });

    it('returns InboundCall with voice undefined when no voice is configured or available', async () => {
      const toPhoneNumber = { id: 10, phoneNumberE164: '+15005550200' };
      const fromPhoneNumber = { id: 55, phoneNumberE164: '+15005550100' };
      const endUser = { id: 20, phoneNumberId: 55, companyId: 5 };

      phoneNumberRepo.findByE164.mockResolvedValueOnce(toPhoneNumber).mockResolvedValueOnce(fromPhoneNumber);
      botRepo.findByPhoneNumberId.mockResolvedValue({ id: 7, userId: 3 });
      userRepo.findById.mockResolvedValue({ id: 3, companyId: 5 });
      voiceRepo.findByBotId.mockResolvedValue(null);
      voiceRepo.findFirstByProvider.mockResolvedValue(null);
      endUserRepo.findByPhoneNumberId.mockResolvedValue(endUser);
      callRepo.create.mockResolvedValue({ id: 42, companyId: 5, externalCallId: 'room-1' });
      participantRepo.create.mockResolvedValue({ id: 1, type: 'bot', botId: 7 });

      const result = await service.startInboundCall(req);

      expect(result.botParticipant.voice).toBeUndefined();
    });
  });

  describe('onParticipantDisconnected', () => {
    it('returns silently when call is not found', async () => {
      callRepo.findByExternalCallId.mockResolvedValue(null);
      await expect(service.onParticipantDisconnected('room-1', 'sip_abc', 'finished')).resolves.toBeUndefined();
    });

    it('throws BadRequestError when no participant matches the identity', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findByCallIdAndExternalId.mockResolvedValue(undefined);
      await expect(service.onParticipantDisconnected('room-1', 'unknown', 'finished')).rejects.toThrow(BadRequestError);
    });

    it('marks the participant as finished with no failure reason', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findByCallIdAndExternalId.mockResolvedValue({ id: 20, type: 'end_user', state: 'connected' });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'finished' },
        { id: 20, type: 'end_user', state: 'connected' },
      ]);

      await service.onParticipantDisconnected('room-1', 'sip_abc', 'finished');

      expect(participantRepo.updateState).toHaveBeenCalledWith(20, 'finished', expect.anything(), undefined);
    });

    it('marks the participant as failed with a failure reason', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findByCallIdAndExternalId.mockResolvedValue({ id: 20, type: 'end_user', state: 'connected' });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'finished' },
        { id: 20, type: 'end_user', state: 'connected' },
      ]);

      await service.onParticipantDisconnected('room-1', 'sip_abc', 'failed', 'SIP trunk failure');

      expect(participantRepo.updateState).toHaveBeenCalledWith(20, 'failed', expect.anything(), 'SIP trunk failure');
    });

    it('marks the call and enqueues summary when all other participants are terminal', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findByCallIdAndExternalId.mockResolvedValue({ id: 20, type: 'end_user', state: 'connected' });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'finished' },
        { id: 20, type: 'end_user', state: 'connected' },
      ]);

      await service.onParticipantDisconnected('room-1', 'sip_abc', 'failed', 'SIP trunk failure');

      expect(callRepo.updateState).toHaveBeenCalledWith(99, 'failed', expect.anything(), 'SIP trunk failure');
      expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ workflowClassName: 'SummarizeCallTranscript' }), 99);
    });

    it('does not mark the call or enqueue summary when other participants are still active', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findByCallIdAndExternalId.mockResolvedValue({ id: 20, type: 'end_user', state: 'connected' });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'connected' },
        { id: 20, type: 'end_user', state: 'connected' },
      ]);

      await service.onParticipantDisconnected('room-1', 'sip_abc', 'finished');

      expect(callRepo.updateState).not.toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  describe('onSessionClosed', () => {
    it('returns silently when call is not found', async () => {
      callRepo.findByExternalCallId.mockResolvedValue(null);
      await expect(service.onSessionClosed('room-1', 'finished')).resolves.toBeUndefined();
    });

    it('throws BadRequestError when bot participant is not found', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findAllByCallId.mockResolvedValue([{ id: 20, type: 'end_user', state: 'finished' }]);
      await expect(service.onSessionClosed('room-1', 'finished')).rejects.toThrow(BadRequestError);
    });

    it('marks bot as finished with no failure reason', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'connected' },
        { id: 20, type: 'end_user', state: 'finished' },
      ]);

      await service.onSessionClosed('room-1', 'finished');

      expect(participantRepo.updateState).toHaveBeenCalledWith(10, 'finished', expect.anything(), undefined);
    });

    it('marks bot as failed with a failure reason', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'connected' },
        { id: 20, type: 'end_user', state: 'finished' },
      ]);

      await service.onSessionClosed('room-1', 'failed', 'Unknown error');

      expect(participantRepo.updateState).toHaveBeenCalledWith(10, 'failed', expect.anything(), 'Unknown error');
    });

    it('marks the call and enqueues summary when all other participants are terminal', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'connected' },
        { id: 20, type: 'end_user', state: 'finished' },
      ]);

      await service.onSessionClosed('room-1', 'finished');

      expect(callRepo.updateState).toHaveBeenCalledWith(99, 'finished', expect.anything(), undefined);
      expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({ workflowClassName: 'SummarizeCallTranscript' }), 99);
    });

    it('does not mark the call or enqueue summary when other participants are still active', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      participantRepo.findAllByCallId.mockResolvedValue([
        { id: 10, type: 'bot', state: 'connected' },
        { id: 20, type: 'end_user', state: 'connected' },
      ]);

      await service.onSessionClosed('room-1', 'finished');

      expect(callRepo.updateState).not.toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  describe('onParticipantJoined', () => {
    it('throws BadRequestError when call is not found', async () => {
      callRepo.findByExternalCallIdWithParticipants.mockResolvedValue(null);
      await expect(service.onParticipantJoined('test-abc')).rejects.toThrow(BadRequestError);
    });

    it('throws BadRequestError when agent participant is not found', async () => {
      callRepo.findByExternalCallIdWithParticipants.mockResolvedValue({ id: 99, participants: [{ type: 'bot', botId: 2 }] });
      await expect(service.onParticipantJoined('test-abc')).rejects.toThrow(BadRequestError);
    });

    it('updates call state and agent participant state to connected in a transaction', async () => {
      const callWithParticipants = { id: 99, participants: [{ id: 20, type: 'agent', userId: 1 }, { type: 'bot', botId: 2 }] };
      callRepo.findByExternalCallIdWithParticipants.mockResolvedValue(callWithParticipants);

      const result = await service.onParticipantJoined('test-abc');

      expect(result).toEqual(callWithParticipants);
      expect(db.transaction).toHaveBeenCalledOnce();
      expect(callRepo.updateState).toHaveBeenCalledWith(99, 'connected', expect.anything());
      expect(participantRepo.updateState).toHaveBeenCalledWith(20, 'connected', expect.anything());
      expect(transcriptRepo.create).toHaveBeenCalledWith({ callId: 99 }, expect.anything());
    });
  });

  describe('saveTranscriptEntry', () => {
    it('returns silently when call is not found', async () => {
      callRepo.findByExternalCallId.mockResolvedValue(null);
      await expect(service.saveTranscriptEntry('room-1', { role: 'user', text: 'hello', sequenceNumber: 0 })).resolves.toBeUndefined();
      expect(transcriptEntryRepo.create).not.toHaveBeenCalled();
    });

    it('returns silently when transcript is not found', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      transcriptRepo.findByCallId.mockResolvedValue(null);
      participantRepo.findAllByCallId.mockResolvedValue([]);
      await expect(service.saveTranscriptEntry('room-1', { role: 'user', text: 'hello', sequenceNumber: 0 })).resolves.toBeUndefined();
      expect(transcriptEntryRepo.create).not.toHaveBeenCalled();
    });

    it('sets botId for assistant role', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      transcriptRepo.findByCallId.mockResolvedValue({ id: 5 });
      participantRepo.findAllByCallId.mockResolvedValue([{ type: 'bot', botId: 7, endUserId: null, userId: null }]);

      await service.saveTranscriptEntry('room-1', { role: 'assistant', text: 'Hi there', sequenceNumber: 0 });

      expect(transcriptEntryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ transcriptId: 5, botId: 7, text: 'Hi there', sequenceNumber: 0 }));
    });

    it('sets endUserId for user role with end_user participant', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      transcriptRepo.findByCallId.mockResolvedValue({ id: 5 });
      participantRepo.findAllByCallId.mockResolvedValue([
        { type: 'bot', botId: 7, endUserId: null, userId: null },
        { type: 'end_user', botId: null, endUserId: 15, userId: null },
      ]);

      await service.saveTranscriptEntry('room-1', { role: 'user', text: 'I need help', sequenceNumber: 1 });

      expect(transcriptEntryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ endUserId: 15 }));
    });

    it('sets userId for user role with agent participant (test call)', async () => {
      callRepo.findByExternalCallId.mockResolvedValue({ id: 99 });
      transcriptRepo.findByCallId.mockResolvedValue({ id: 5 });
      participantRepo.findAllByCallId.mockResolvedValue([
        { type: 'bot', botId: 7, endUserId: null, userId: null },
        { type: 'agent', botId: null, endUserId: null, userId: 3 },
      ]);

      await service.saveTranscriptEntry('test-room', { role: 'user', text: 'Testing', sequenceNumber: 0 });

      expect(transcriptEntryRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 3 }));
    });
  });

  describe('listCalls', () => {
    it('throws BadRequestError when user has no company', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: null });
      await expect(service.listCalls(1)).rejects.toThrow(BadRequestError);
    });

    it('returns calls without transcripts when expand is omitted', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      callRepo.findAllByCompanyId.mockResolvedValue([{ id: 10, fromPhoneNumberId: 1 }, { id: 11, fromPhoneNumberId: 2 }]);

      const result = await service.listCalls(1);

      expect(result.calls).toHaveLength(2);
      expect(result.transcripts).toBeUndefined();
      expect(callRepo.findAllByCompanyId).toHaveBeenCalledWith(5, {
        pageToken: undefined, limit: undefined, sort: undefined,
      });
    });

    it('passes pagination and sort options to the repository', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      callRepo.findAllByCompanyId.mockResolvedValue([]);

      await service.listCalls(1, { pageToken: 42, limit: 5, sort: 'asc' });

      expect(callRepo.findAllByCompanyId).toHaveBeenCalledWith(5, {
        pageToken: 42, limit: 5, sort: 'asc',
      });
    });

    it('expands transcripts with entries when expand includes transcript', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      callRepo.findAllByCompanyId.mockResolvedValue([{ id: 10, fromPhoneNumberId: 1 }]);
      transcriptRepo.findByCallId.mockResolvedValue({ id: 100, summary: 'A summary' });
      transcriptEntryRepo.findAllByTranscriptId.mockResolvedValue([
        { id: 1, text: 'Hello', sequenceNumber: 0 },
      ]);

      const result = await service.listCalls(1, { expand: ['transcript'] });

      expect(result.transcripts).toBeDefined();
      expect(result.transcripts!.get(10)).toEqual({
        id: 100,
        summary: 'A summary',
        entries: [{ id: 1, text: 'Hello', sequenceNumber: 0 }],
      });
    });

    it('skips transcript expansion for calls without a transcript', async () => {
      userRepo.findById.mockResolvedValue({ id: 1, companyId: 5 });
      callRepo.findAllByCompanyId.mockResolvedValue([{ id: 10, fromPhoneNumberId: 1 }]);
      transcriptRepo.findByCallId.mockResolvedValue(undefined);

      const result = await service.listCalls(1, { expand: ['transcript'] });

      expect(result.transcripts!.size).toBe(0);
    });
  });
});
