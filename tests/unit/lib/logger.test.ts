import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@livekit/agents', () => ({
  log: vi.fn(),
}));

vi.mock('@dbos-inc/dbos-sdk', () => ({
  DBOS: {
    isWithinWorkflow: vi.fn().mockReturnValue(false),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  },
}));

import { log } from '@livekit/agents';
import { DBOS } from '@dbos-inc/dbos-sdk';
import { createLogger, markAsLiveKitAgent, _resetForTesting } from '../../../src/lib/logger.js';

const mockLog = vi.mocked(log);
const mockDbos = vi.mocked(DBOS);

beforeEach(() => {
  vi.clearAllMocks();
  _resetForTesting();
});

afterEach(() => {
  _resetForTesting();
});

describe('selectBackend — Pino path', () => {
  it('routes to Pino when IS_LIVEKIT_AGENT=false and DBOS not in workflow', () => {
    mockDbos.isWithinWorkflow.mockReturnValue(false);
    const pinoSpy = vi.fn();
    mockLog.mockReturnValue({ info: pinoSpy } as any);

    const logger = createLogger('test');
    logger.info({ key: 'val' }, 'msg');

    expect(pinoSpy).not.toHaveBeenCalled();
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });

  it('falls back to Pino when DBOS.isWithinWorkflow throws', () => {
    mockDbos.isWithinWorkflow.mockImplementation(() => { throw new Error('not initialized'); });
    const lkSpy = vi.fn();
    mockLog.mockReturnValue({ info: lkSpy } as any);

    const logger = createLogger('test');
    expect(() => logger.info({}, 'msg')).not.toThrow();
    expect(lkSpy).not.toHaveBeenCalled();
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });
});

describe('selectBackend — DBOS path', () => {
  it('routes to DBOS when inside workflow', () => {
    mockDbos.isWithinWorkflow.mockReturnValue(true);

    const logger = createLogger('test');
    logger.info({ callId: 1 }, 'started');

    expect(mockDbos.logger.info).toHaveBeenCalledWith({ msg: 'started', callId: 1 });
  });

  it('normalizes message into msg field', () => {
    mockDbos.isWithinWorkflow.mockReturnValue(true);

    createLogger('test').warn({ x: 2 }, 'warning');

    expect(mockDbos.logger.warn).toHaveBeenCalledWith({ msg: 'warning', x: 2 });
  });
});

describe('selectBackend — LiveKit path', () => {
  it('routes to LiveKit when IS_LIVEKIT_AGENT=true', () => {
    const lkInfo = vi.fn();
    mockLog.mockReturnValue({ info: lkInfo } as any);
    markAsLiveKitAgent();

    createLogger('test').info({ room: 'r1' }, 'connected');

    expect(lkInfo).toHaveBeenCalledWith({ room: 'r1' }, 'connected');
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });

  it('LiveKit flag takes priority over DBOS context', () => {
    const lkInfo = vi.fn();
    mockLog.mockReturnValue({ info: lkInfo } as any);
    mockDbos.isWithinWorkflow.mockReturnValue(true);
    markAsLiveKitAgent();

    createLogger('test').info({}, 'msg');

    expect(lkInfo).toHaveBeenCalled();
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });

  it('falls back to Pino when log() throws TypeError', () => {
    mockLog.mockReturnValue({
      info: vi.fn().mockImplementation(() => { throw new TypeError('not initialized'); }),
    } as any);
    markAsLiveKitAgent();

    expect(() => createLogger('test').info({}, 'msg')).not.toThrow();
  });

  it('propagates non-TypeError errors from log()', () => {
    mockLog.mockReturnValue({
      info: vi.fn().mockImplementation(() => { throw new RangeError('unexpected'); }),
    } as any);
    markAsLiveKitAgent();

    expect(() => createLogger('test').info({}, 'msg')).toThrow(RangeError);
  });
});

describe('markAsLiveKitAgent', () => {
  it('sets IS_LIVEKIT_AGENT to true', () => {
    const lkInfo = vi.fn();
    mockLog.mockReturnValue({ info: lkInfo } as any);
    markAsLiveKitAgent();

    createLogger('test').info({}, 'msg');

    expect(lkInfo).toHaveBeenCalled();
  });

  it('is idempotent — calling twice does not throw', () => {
    expect(() => { markAsLiveKitAgent(); markAsLiveKitAgent(); }).not.toThrow();
  });
});

describe('toDbosPayload', () => {
  beforeEach(() => mockDbos.isWithinWorkflow.mockReturnValue(true));

  it('merges fields and message into { msg, ...fields }', () => {
    createLogger('test').info({ callId: 7 }, 'hello');
    expect(mockDbos.logger.info).toHaveBeenCalledWith({ msg: 'hello', callId: 7 });
  });

  it('message overwrites an existing msg field in fields', () => {
    createLogger('test').info({ msg: 'old', callId: 3 }, 'new');
    expect(mockDbos.logger.info).toHaveBeenCalledWith({ msg: 'new', callId: 3 });
  });
});

describe('createLogger — construction', () => {
  it('creates a logger without throwing', () => {
    expect(() => createLogger('any-name')).not.toThrow();
  });
});
