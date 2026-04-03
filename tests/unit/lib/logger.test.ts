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
import { createLogger } from '../../../src/lib/logger.js';

const mockLog = vi.mocked(log);
const mockDbos = vi.mocked(DBOS);

beforeEach(() => vi.clearAllMocks());

describe('selectBackend — Pino path', () => {
  beforeEach(() => { delete process.env.PHONETASTIC_COMPONENT_NAME; });
  afterEach(() => { delete process.env.PHONETASTIC_COMPONENT_NAME; });

  it('routes to Pino when env unset and DBOS not in workflow', () => {
    mockDbos.isWithinWorkflow.mockReturnValue(false);
    const logger = createLogger('test');
    logger.info({ key: 'val' }, 'msg');
    expect(mockLog).not.toHaveBeenCalled();
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });

  it('falls back to Pino when DBOS.isWithinWorkflow throws', () => {
    mockDbos.isWithinWorkflow.mockImplementation(() => { throw new Error('not initialized'); });
    const logger = createLogger('test');
    expect(() => logger.info({}, 'msg')).not.toThrow();
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });
});

describe('selectBackend — DBOS path', () => {
  beforeEach(() => { delete process.env.PHONETASTIC_COMPONENT_NAME; });
  afterEach(() => { delete process.env.PHONETASTIC_COMPONENT_NAME; });

  it('routes to DBOS when inside workflow', () => {
    mockDbos.isWithinWorkflow.mockReturnValue(true);
    createLogger('test').info({ callId: 1 }, 'started');
    expect(mockDbos.logger.info).toHaveBeenCalledWith({ msg: 'started', callId: 1 });
  });

  it('normalizes message into msg field', () => {
    mockDbos.isWithinWorkflow.mockReturnValue(true);
    createLogger('test').warn({ x: 2 }, 'warning');
    expect(mockDbos.logger.warn).toHaveBeenCalledWith({ msg: 'warning', x: 2 });
  });
});

describe('selectBackend — LiveKit path', () => {
  beforeEach(() => { process.env.PHONETASTIC_COMPONENT_NAME = 'agent'; });
  afterEach(() => { delete process.env.PHONETASTIC_COMPONENT_NAME; });

  it('routes to LiveKit when PHONETASTIC_COMPONENT_NAME=agent', () => {
    const lkInfo = vi.fn();
    mockLog.mockReturnValue({ info: lkInfo } as any);
    createLogger('test').info({ room: 'r1' }, 'connected');
    expect(lkInfo).toHaveBeenCalledWith({ room: 'r1' }, 'connected');
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });

  it('LiveKit does not check DBOS context', () => {
    const lkInfo = vi.fn();
    mockLog.mockReturnValue({ info: lkInfo } as any);
    mockDbos.isWithinWorkflow.mockReturnValue(true);
    createLogger('test').info({}, 'msg');
    expect(lkInfo).toHaveBeenCalled();
    expect(mockDbos.logger.info).not.toHaveBeenCalled();
  });

  it('falls back to Pino when log() throws TypeError', () => {
    mockLog.mockReturnValue({
      info: vi.fn().mockImplementation(() => { throw new TypeError('not initialized'); }),
    } as any);
    expect(() => createLogger('test').info({}, 'msg')).not.toThrow();
  });

  it('propagates non-TypeError errors from log()', () => {
    mockLog.mockReturnValue({
      info: vi.fn().mockImplementation(() => { throw new RangeError('unexpected'); }),
    } as any);
    expect(() => createLogger('test').info({}, 'msg')).toThrow(RangeError);
  });
});

describe('toDbosPayload', () => {
  beforeEach(() => {
    delete process.env.PHONETASTIC_COMPONENT_NAME;
    mockDbos.isWithinWorkflow.mockReturnValue(true);
  });
  afterEach(() => { delete process.env.PHONETASTIC_COMPONENT_NAME; });

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
