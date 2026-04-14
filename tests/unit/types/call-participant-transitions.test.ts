import { describe, it, expect } from 'vitest';
import {
  WaitingAgentParticipantSchema,
  ConnectingAgentParticipantSchema,
  ConnectedAgentParticipantSchema,
  ConnectedBotParticipantSchema,
  FinishedAgentParticipantSchema,
  FailedAgentParticipantSchema,
  WaitingBotParticipantSchema,
} from '../../../src/types/call-participant.js';
import {
  transitionParticipantToConnected,
  disconnectParticipant,
} from '../../../src/types/call-participant-transitions.js';
import { ConnectedInboundCallSchema } from '../../../src/types/call.js';

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

const waitingAgent = WaitingAgentParticipantSchema.parse({ ...agentBase, state: 'waiting' });
const connectingAgent = ConnectingAgentParticipantSchema.parse({ ...agentBase, state: 'connecting' });
const connectedAgent = ConnectedAgentParticipantSchema.parse({ ...agentBase, state: 'connected' });
const finishedAgent = FinishedAgentParticipantSchema.parse({ ...agentBase, state: 'finished' });
const failedAgent = FailedAgentParticipantSchema.parse({ ...agentBase, state: 'failed' });
const waitingBot = WaitingBotParticipantSchema.parse({ ...botBase, state: 'waiting' });

const connectedCall = ConnectedInboundCallSchema.parse({
  id: 10,
  externalCallId: 'ext-call-001',
  companyId: 1,
  fromPhoneNumberId: 1,
  toPhoneNumberId: 2,
  testMode: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  direction: 'inbound',
  state: 'connected',
  failureReason: null,
});

describe('transitionParticipantToConnected', () => {
  it('transitions waiting agent to connected', () => {
    const result = transitionParticipantToConnected(waitingAgent);
    expect(result.state).toBe('connected');
    expect(result.type).toBe('agent');
  });

  it('transitions connecting agent to connected', () => {
    const result = transitionParticipantToConnected(connectingAgent);
    expect(result.state).toBe('connected');
  });

  it('transitions waiting bot to connected', () => {
    const result = transitionParticipantToConnected(waitingBot);
    const parsed = ConnectedBotParticipantSchema.parse(result);
    expect(parsed.state).toBe('connected');
  });
});

describe('disconnectParticipant — terminated participant', () => {
  it('returns participant with state finished', () => {
    const [terminated] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent], 'finished');
    expect(terminated.state).toBe('finished');
    expect(terminated.id).toBe(connectedAgent.id);
  });

  it('returns participant with state failed and failureReason', () => {
    const [terminated] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent], 'failed', 'network error');
    expect(terminated.state).toBe('failed');
    expect(terminated.failureReason).toBe('network error');
  });

  it('sets failureReason null when state is finished', () => {
    const [terminated] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent], 'finished');
    expect(terminated.failureReason).toBeNull();
  });
});

describe('disconnectParticipant — call transition', () => {
  it('keeps call as ConnectedCall when another participant is active', () => {
    const other = ConnectedAgentParticipantSchema.parse({ ...agentBase, id: 2, state: 'connected' });
    const [, updatedCall] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent, other], 'finished');
    expect(updatedCall.state).toBe('connected');
  });

  it('transitions call to FinishedCall when all others are terminal and state is finished', () => {
    const [, updatedCall] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent, finishedAgent], 'finished');
    expect(updatedCall.state).toBe('finished');
  });

  it('transitions call to FailedCall when all others are terminal and state is failed', () => {
    const [, updatedCall] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent, failedAgent], 'failed', 'crash');
    expect(updatedCall.state).toBe('failed');
    expect((updatedCall as { failureReason: string }).failureReason).toBe('crash');
  });

  it('transitions call to FinishedCall when participant is the only one', () => {
    const [, updatedCall] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent], 'finished');
    expect(updatedCall.state).toBe('finished');
  });

  it('keeps call as ConnectedCall when another participant is waiting', () => {
    const waiting = WaitingAgentParticipantSchema.parse({ ...agentBase, id: 99, state: 'waiting' });
    const [, updatedCall] = disconnectParticipant(connectedCall, connectedAgent, [connectedAgent, waiting], 'finished');
    expect(updatedCall.state).toBe('connected');
  });
});
