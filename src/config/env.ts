import { z } from 'zod';
import 'dotenv/config';

export const envSchema = z.object({
  TZ: z.string().default('UTC'),
  PORT: z.coerce.number().default(3333),
  HOST: z.string().default('localhost'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_KEY: z.string().min(1),
  DATABASE_URL: z.string().url().optional(),
  DIRECT_DATABASE_URL: z.string().url().optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default(''),
  DB_DATABASE: z.string().default('phonetastic_dev'),
  DEV_PHONE_NUMBER: z.string().default('+15005550100'),
  LIVEKIT_URL: z.string().url().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  DEEPGRAM_API_KEY: z.string().optional(),
  CARTESIA_API_KEY: z.string().optional(),
  PHONIC_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  GODADDY_API_KEY: z.string().optional(),
  GODADDY_API_SECRET: z.string().optional(),
  GODADDY_DOMAIN: z.string().default('mail.phonetastic.ai'),
  TIGRIS_BUCKET_NAME: z.string().optional(),
  AWS_ENDPOINT_URL_S3: z.string().optional(),
  AWS_REGION: z.string().default('auto'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .string()
    .url('OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL starting with http:// or https://')
    .refine(
      (val) => val.startsWith('http://') || val.startsWith('https://'),
      'OTEL_EXPORTER_OTLP_ENDPOINT must start with http:// or https://',
    )
    .optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_EXPORTER_OTLP_PROTOCOL: z
    .enum(['http/protobuf', 'http/json', 'grpc'], {
      message: "OTEL_EXPORTER_OTLP_PROTOCOL must be one of 'http/protobuf', 'http/json', or 'grpc'",
    })
    .default('http/protobuf'),
  OTEL_SERVICE_NAME: z.string().default('phonetastic'),
  AGENT_NAME: z.string().default('phonetastic-agent'),
  DEFAULT_VOICE_PROVIDER: z.enum(['phonic', 'openai', 'xai', 'google']).default('phonic'),
});

export type Env = z.infer<typeof envSchema>;
export type VoiceProvider = Env['DEFAULT_VOICE_PROVIDER'];

export const env: Env = envSchema.parse(process.env);
