/**
 * Abstraction for Twilio-backed telephony operations: SMS and call control.
 */
export interface TelephonyService {
  /**
   * Sends an outbound SMS message.
   *
   * @param to - Destination E.164 phone number.
   * @param from - Sender E.164 phone number (must be owned by the account).
   * @param body - Text content of the message.
   * @returns The external message SID assigned by the provider.
   */
  sendSms(to: string, from: string, body: string): Promise<string>;

  /**
   * Initiates an outbound call and returns when it is queued.
   *
   * @param to - Destination E.164 phone number.
   * @param from - Caller-ID E.164 phone number.
   * @param twimlUrl - Webhook URL that returns TwiML instructions for the call.
   * @returns The external call SID assigned by the provider.
   */
  makeCall(to: string, from: string, twimlUrl: string): Promise<string>;

  /**
   * Places an active call on hold by redirecting it to hold TwiML.
   *
   * @param callSid - The provider call SID to hold.
   * @param holdTwimlUrl - Webhook URL returning TwiML that plays hold music.
   */
  holdCall(callSid: string, holdTwimlUrl: string): Promise<void>;

  /**
   * Resumes a held call by redirecting it to new TwiML.
   *
   * @param callSid - The provider call SID to resume.
   * @param twimlUrl - Webhook URL returning TwiML that continues the call.
   */
  resumeCall(callSid: string, twimlUrl: string): Promise<void>;

  /**
   * Forwards a call to a new destination by redirecting via TwiML.
   *
   * @param callSid - The provider call SID to forward.
   * @param to - Destination E.164 phone number.
   */
  forwardCall(callSid: string, to: string): Promise<void>;

  /**
   * Transfers a call to a new destination, replacing the current TwiML.
   *
   * @param callSid - The provider call SID to transfer.
   * @param twimlUrl - Webhook URL returning TwiML for the new destination.
   */
  transferCall(callSid: string, twimlUrl: string): Promise<void>;

  /**
   * Hangs up an active call.
   *
   * @param callSid - The provider call SID to hang up.
   */
  hangupCall(callSid: string): Promise<void>;
}

/**
 * Stub implementation for testing — records all calls in-memory.
 */
export class StubTelephonyService implements TelephonyService {
  public readonly sentMessages: Array<{ to: string; from: string; body: string }> = [];
  public readonly madeCalls: Array<{ to: string; from: string; twimlUrl: string }> = [];
  public readonly heldCalls: string[] = [];
  public readonly resumedCalls: string[] = [];
  public readonly forwardedCalls: Array<{ callSid: string; to: string }> = [];
  public readonly transferredCalls: Array<{ callSid: string; twimlUrl: string }> = [];
  public readonly hungUpCalls: string[] = [];

  async sendSms(to: string, from: string, body: string): Promise<string> {
    this.sentMessages.push({ to, from, body });
    return `stub-sm-${Date.now()}`;
  }

  async makeCall(to: string, from: string, twimlUrl: string): Promise<string> {
    this.madeCalls.push({ to, from, twimlUrl });
    return `stub-ca-${Date.now()}`;
  }

  async holdCall(callSid: string, _holdTwimlUrl: string): Promise<void> {
    this.heldCalls.push(callSid);
  }

  async resumeCall(callSid: string, _twimlUrl: string): Promise<void> {
    this.resumedCalls.push(callSid);
  }

  async forwardCall(callSid: string, to: string): Promise<void> {
    this.forwardedCalls.push({ callSid, to });
  }

  async transferCall(callSid: string, twimlUrl: string): Promise<void> {
    this.transferredCalls.push({ callSid, twimlUrl });
  }

  async hangupCall(callSid: string): Promise<void> {
    this.hungUpCalls.push(callSid);
  }
}

/**
 * Twilio-backed TelephonyService using the Twilio REST API.
 *
 * @precondition Valid Twilio account SID and auth token must be provided.
 */
export class TwilioTelephonyService implements TelephonyService {
  private readonly client: ReturnType<typeof import('twilio')>;

  /**
   * @param accountSid - Twilio account SID.
   * @param authToken - Twilio auth token.
   */
  constructor(accountSid: string, authToken: string) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    this.client = twilio(accountSid, authToken);
  }

  /** {@inheritDoc TelephonyService.sendSms} */
  async sendSms(to: string, from: string, body: string): Promise<string> {
    const message = await this.client.messages.create({ to, from, body });
    return message.sid;
  }

  /** {@inheritDoc TelephonyService.makeCall} */
  async makeCall(to: string, from: string, twimlUrl: string): Promise<string> {
    const call = await this.client.calls.create({ to, from, url: twimlUrl });
    return call.sid;
  }

  /** {@inheritDoc TelephonyService.holdCall} */
  async holdCall(callSid: string, holdTwimlUrl: string): Promise<void> {
    await this.client.calls(callSid).update({ url: holdTwimlUrl, method: 'POST' });
  }

  /** {@inheritDoc TelephonyService.resumeCall} */
  async resumeCall(callSid: string, twimlUrl: string): Promise<void> {
    await this.client.calls(callSid).update({ url: twimlUrl, method: 'POST' });
  }

  /** {@inheritDoc TelephonyService.forwardCall} */
  async forwardCall(callSid: string, to: string): Promise<void> {
    const twiml = `<Response><Dial>${to}</Dial></Response>`;
    await this.client.calls(callSid).update({ twiml });
  }

  /** {@inheritDoc TelephonyService.transferCall} */
  async transferCall(callSid: string, twimlUrl: string): Promise<void> {
    await this.client.calls(callSid).update({ url: twimlUrl, method: 'POST' });
  }

  /** {@inheritDoc TelephonyService.hangupCall} */
  async hangupCall(callSid: string): Promise<void> {
    await this.client.calls(callSid).update({ status: 'completed' });
  }
}
