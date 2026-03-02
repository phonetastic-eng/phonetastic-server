import { describe, it, expect, vi } from 'vitest';
import { StubSmsService, TwilioSmsService } from '../../../src/services/sms-service.js';

describe('StubSmsService', () => {
  it('records sent messages', async () => {
    const service = new StubSmsService();
    await service.send('+15551234567', 'Hello!');
    expect(service.sent).toEqual([{ to: '+15551234567', body: 'Hello!' }]);
  });
});

describe('TwilioSmsService', () => {
  it('sends via messagingServiceSid', async () => {
    const messages = { create: vi.fn().mockResolvedValue({}) };
    const service = new TwilioSmsService(messages, { messagingServiceSid: 'MG1234567890abcdef' });

    await service.send('+15551234567', 'Test message');

    expect(messages.create).toHaveBeenCalledWith({
      to: '+15551234567',
      body: 'Test message',
      messagingServiceSid: 'MG1234567890abcdef',
    });
  });

  it('sends via from number', async () => {
    const messages = { create: vi.fn().mockResolvedValue({}) };
    const service = new TwilioSmsService(messages, { from: '+15005550006' });

    await service.send('+15551234567', 'Test message');

    expect(messages.create).toHaveBeenCalledWith({
      to: '+15551234567',
      body: 'Test message',
      from: '+15005550006',
    });
  });
});
