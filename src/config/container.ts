import 'reflect-metadata';
import { container } from 'tsyringe';
import { createDb, type Database } from '../db/index.js';
import { StubSmsService, TwilioSmsService, type SmsService } from '../services/sms-service.js';
import { StubLiveKitService, LiveKitServiceImpl, type LiveKitService } from '../services/livekit-service.js';
import { StubGoogleOAuthService, RealGoogleOAuthService, type GoogleOAuthService } from '../services/google-oauth-service.js';
import { StubFirecrawlService, RealFirecrawlService, type FirecrawlService } from '../services/firecrawl-service.js';
import { OtpRepository } from '../repositories/otp-repository.js';
import { PhoneNumberRepository } from '../repositories/phone-number-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import { BotRepository } from '../repositories/bot-repository.js';
import { BotSettingsRepository } from '../repositories/bot-settings-repository.js';
import { CallSettingsRepository } from '../repositories/call-settings-repository.js';
import { VoiceRepository } from '../repositories/voice-repository.js';
import { CompanyRepository } from '../repositories/company-repository.js';
import { SkillRepository } from '../repositories/skill-repository.js';
import { CallRepository } from '../repositories/call-repository.js';
import { CalendarRepository } from '../repositories/calendar-repository.js';
import { CallParticipantRepository } from '../repositories/call-participant-repository.js';
import { FaqRepository } from '../repositories/faq-repository.js';
import { OfferingRepository } from '../repositories/offering-repository.js';
import { AddressRepository } from '../repositories/address-repository.js';
import { OperationHourRepository } from '../repositories/operation-hour-repository.js';
import { AuthService } from '../services/auth-service.js';
import { CompanyService } from '../services/company-service.js';
import { OtpService } from '../services/otp-service.js';
import { UserService } from '../services/user-service.js';
import { PhoneNumberService } from '../services/phone-number-service.js';
import { CallService } from '../services/call-service.js';
import { env } from './env.js';

function createSmsService(): SmsService {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID, TWILIO_FROM_NUMBER } = env;
  const sender = TWILIO_MESSAGING_SERVICE_SID
    ? { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID }
    : TWILIO_FROM_NUMBER
      ? { from: TWILIO_FROM_NUMBER }
      : null;
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && sender) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const twilio = require('twilio');
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    return new TwilioSmsService(client.messages, sender);
  }
  return new StubSmsService();
}

function createLiveKitService(): LiveKitService {
  if (env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) {
    return new LiveKitServiceImpl(env.LIVEKIT_URL, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
  }
  return new StubLiveKitService();
}

function createGoogleOAuthService(): GoogleOAuthService {
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI) {
    return new RealGoogleOAuthService(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
  }
  return new StubGoogleOAuthService();
}

function createFirecrawlService(): FirecrawlService {
  if (env.FIRECRAWL_API_KEY) {
    return new RealFirecrawlService(env.FIRECRAWL_API_KEY);
  }
  return new StubFirecrawlService();
}

/**
 * Initializes the Tsyringe DI container with core dependencies.
 *
 * @precondition Environment variables must be loaded before calling this.
 * @postcondition All repositories, services, and infrastructure are registered.
 * @param overrides - Optional dependency overrides for testing.
 * @param overrides.db - A pre-configured Database instance.
 * @param overrides.smsService - A custom SmsService implementation.
 * @param overrides.livekitService - A custom LiveKitService implementation.
 * @param overrides.googleOAuthService - A custom GoogleOAuthService implementation.
 * @param overrides.firecrawlService - A custom FirecrawlService implementation.
 */
export function setupContainer(overrides?: {
  db?: Database;
  smsService?: SmsService;
  livekitService?: LiveKitService;
  googleOAuthService?: GoogleOAuthService;
  firecrawlService?: FirecrawlService;
}): void {
  const db = overrides?.db ?? createDb();
  container.registerInstance<Database>('Database', db);

  container.registerInstance<SmsService>('SmsService', overrides?.smsService ?? createSmsService());
  container.registerInstance<LiveKitService>('LiveKitService', overrides?.livekitService ?? createLiveKitService());
  container.registerInstance<GoogleOAuthService>('GoogleOAuthService', overrides?.googleOAuthService ?? createGoogleOAuthService());
  container.registerInstance<FirecrawlService>('FirecrawlService', overrides?.firecrawlService ?? createFirecrawlService());

  container.register('OtpRepository', { useClass: OtpRepository });
  container.register('PhoneNumberRepository', { useClass: PhoneNumberRepository });
  container.register('UserRepository', { useClass: UserRepository });
  container.register('BotRepository', { useClass: BotRepository });
  container.register('BotSettingsRepository', { useClass: BotSettingsRepository });
  container.register('CallSettingsRepository', { useClass: CallSettingsRepository });
  container.register('VoiceRepository', { useClass: VoiceRepository });
  container.register('CompanyRepository', { useClass: CompanyRepository });
  container.register('SkillRepository', { useClass: SkillRepository });
  container.register('CallRepository', { useClass: CallRepository });
  container.register('CalendarRepository', { useClass: CalendarRepository });
  container.register('CallParticipantRepository', { useClass: CallParticipantRepository });
  container.register('FaqRepository', { useClass: FaqRepository });
  container.register('OfferingRepository', { useClass: OfferingRepository });
  container.register('AddressRepository', { useClass: AddressRepository });
  container.register('OperationHourRepository', { useClass: OperationHourRepository });
  container.register('AuthService', { useClass: AuthService });
  container.register('CompanyService', { useClass: CompanyService });
  container.register('OtpService', { useClass: OtpService });
  container.register('UserService', { useClass: UserService });
  container.register('PhoneNumberService', { useClass: PhoneNumberService });
  container.register('CallService', { useClass: CallService });
}

export { container };
