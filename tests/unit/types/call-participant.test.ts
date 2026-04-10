import { describe, it, expect } from 'vitest';
import {
  WaitingAgentParticipantSchema,
  ConnectingAgentParticipantSchema,
  ConnectedAgentParticipantSchema,
  FinishedAgentParticipantSchema,
  FailedAgentParticipantSchema,
  WaitingBotParticipantSchema,
  ConnectingBotParticipantSchema,
  ConnectedBotParticipantSchema,
  FinishedBotParticipantSchema,
  FailedBotParticipantSchema,
  WaitingEndUserParticipantSchema,
  ConnectingEndUserParticipantSchema,
  ConnectedEndUserParticipantSchema,
  FinishedEndUserParticipantSchema,
  FailedEndUserParticipantSchema,
  isAgentParticipant,
  isBotParticipant,
  isEndUserParticipant,
  isFailedBotParticipant,
} from '../../../src/types/call-participant.js';

const baseParticipant = {
  id: 1,
  externalId: 'ext-001',
  agentId: null,
  companyId: 1,
  callId: 1,
  voiceId: null,
  failureReason: null,
};

const agentBase = { ...baseParticipant, type: 'agent' as const, userId: 1, botId: null, endUserId: null };
const botBase = { ...baseParticipant, type: 'bot' as const, botId: 1, userId: null, endUserId: null };
const endUserBase = { ...baseParticipant, type: 'end_user' as const, endUserId: 1, userId: null, botId: null };

describe('agent participant schemas', () => {
  it('parses WaitingAgentParticipant', () => {
    expect(WaitingAgentParticipantSchema.parse({ ...agentBase, state: 'waiting' }).type).toBe('agent');
  });

  it('parses ConnectingAgentParticipant', () => {
    expect(() => ConnectingAgentParticipantSchema.parse({ ...agentBase, state: 'connecting' })).not.toThrow();
  });

  it('parses ConnectedAgentParticipant', () => {
    expect(() => ConnectedAgentParticipantSchema.parse({ ...agentBase, state: 'connected' })).not.toThrow();
  });

  it('parses FinishedAgentParticipant', () => {
    expect(() => FinishedAgentParticipantSchema.parse({ ...agentBase, state: 'finished' })).not.toThrow();
  });

  it('parses FailedAgentParticipant', () => {
    expect(() => FailedAgentParticipantSchema.parse({ ...agentBase, state: 'failed' })).not.toThrow();
  });
});

describe('bot participant schemas', () => {
  it('parses WaitingBotParticipant', () => {
    expect(WaitingBotParticipantSchema.parse({ ...botBase, state: 'waiting' }).type).toBe('bot');
  });

  it('parses ConnectingBotParticipant', () => {
    expect(() => ConnectingBotParticipantSchema.parse({ ...botBase, state: 'connecting' })).not.toThrow();
  });

  it('parses ConnectedBotParticipant', () => {
    expect(() => ConnectedBotParticipantSchema.parse({ ...botBase, state: 'connected' })).not.toThrow();
  });

  it('parses FinishedBotParticipant', () => {
    expect(() => FinishedBotParticipantSchema.parse({ ...botBase, state: 'finished' })).not.toThrow();
  });

  it('parses FailedBotParticipant', () => {
    expect(() => FailedBotParticipantSchema.parse({ ...botBase, state: 'failed' })).not.toThrow();
  });
});

describe('end_user participant schemas', () => {
  it('parses WaitingEndUserParticipant', () => {
    expect(WaitingEndUserParticipantSchema.parse({ ...endUserBase, state: 'waiting' }).type).toBe('end_user');
  });

  it('parses ConnectingEndUserParticipant', () => {
    expect(() => ConnectingEndUserParticipantSchema.parse({ ...endUserBase, state: 'connecting' })).not.toThrow();
  });

  it('parses ConnectedEndUserParticipant', () => {
    expect(() => ConnectedEndUserParticipantSchema.parse({ ...endUserBase, state: 'connected' })).not.toThrow();
  });

  it('parses FinishedEndUserParticipant', () => {
    expect(() => FinishedEndUserParticipantSchema.parse({ ...endUserBase, state: 'finished' })).not.toThrow();
  });

  it('parses FailedEndUserParticipant', () => {
    expect(() => FailedEndUserParticipantSchema.parse({ ...endUserBase, state: 'failed' })).not.toThrow();
  });
});

describe('type predicates', () => {
  const agent = WaitingAgentParticipantSchema.parse({ ...agentBase, state: 'waiting' });
  const bot = WaitingBotParticipantSchema.parse({ ...botBase, state: 'waiting' });
  const endUser = WaitingEndUserParticipantSchema.parse({ ...endUserBase, state: 'waiting' });
  const failedBot = FailedBotParticipantSchema.parse({ ...botBase, state: 'failed' });

  it('isAgentParticipant returns true for agent', () => {
    expect(isAgentParticipant(agent)).toBe(true);
  });

  it('isAgentParticipant returns false for bot', () => {
    expect(isAgentParticipant(bot)).toBe(false);
  });

  it('isBotParticipant returns true for bot', () => {
    expect(isBotParticipant(bot)).toBe(true);
  });

  it('isBotParticipant returns false for end_user', () => {
    expect(isBotParticipant(endUser)).toBe(false);
  });

  it('isEndUserParticipant returns true for end_user', () => {
    expect(isEndUserParticipant(endUser)).toBe(true);
  });

  it('isEndUserParticipant returns false for agent', () => {
    expect(isEndUserParticipant(agent)).toBe(false);
  });

  it('isFailedBotParticipant returns true for failed bot', () => {
    expect(isFailedBotParticipant(failedBot)).toBe(true);
  });

  it('isFailedBotParticipant returns false for waiting bot', () => {
    expect(isFailedBotParticipant(bot)).toBe(false);
  });
});
