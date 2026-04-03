import pino from 'pino';
import { log } from '@livekit/agents';
import { DBOS } from '@dbos-inc/dbos-sdk';

/**
 * Unified structured logger interface satisfied by all three backends.
 *
 * @param fieldsOrMessage - Structured context fields, or the message string when called with one argument.
 * @param message - Human-readable log message (required when fieldsOrMessage is an object).
 */
export interface Logger {
  info(fieldsOrMessage: object | string, message?: string): void;
  warn(fieldsOrMessage: object | string, message?: string): void;
  error(fieldsOrMessage: object | string, message?: string): void;
  debug(fieldsOrMessage: object | string, message?: string): void;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

function normalizeArgs(fieldsOrMessage: object | string, message?: string): [object, string] {
  if (typeof fieldsOrMessage === 'string') return [{}, fieldsOrMessage];
  return [fieldsOrMessage, message ?? ''];
}

/**
 * Creates a named logger. The backend is selected once at call time:
 *
 * - LiveKit backend: when `PHONETASTIC_COMPONENT_NAME=agent` at construction.
 * - DBOS backend: when inside a DBOS workflow, step, or transaction (checked per call).
 * - Pino backend: all other cases.
 *
 * @param name - Identifier that appears in Pino log records (e.g. `"call-service"`).
 * @returns A {@link Logger} that dispatches to the correct backend.
 */
export function createLogger(name: string): Logger {
  const pinoLogger = buildPinoLogger(name);
  if (process.env.PHONETASTIC_COMPONENT_NAME === 'agent') {
    return buildLiveKitLogger(pinoLogger);
  }
  return buildServerLogger(pinoLogger);
}

function buildLiveKitLogger(fallback: pino.Logger): Logger {
  const dispatch = (level: Level) => (fieldsOrMessage: object | string, message?: string) =>
    logViaLiveKit(level, ...normalizeArgs(fieldsOrMessage, message), fallback);
  return { info: dispatch('info'), warn: dispatch('warn'), error: dispatch('error'), debug: dispatch('debug') };
}

function buildServerLogger(pinoLogger: pino.Logger): Logger {
  const dispatch = (level: Level) => (fieldsOrMessage: object | string, message?: string) => {
    const [fields, msg] = normalizeArgs(fieldsOrMessage, message);
    try {
      if (DBOS.isWithinWorkflow()) return DBOS.logger[level](toDbosPayload(fields, msg));
    } catch { /* not in DBOS context */ }
    pinoLogger[level](fields, msg);
  };
  return { info: dispatch('info'), warn: dispatch('warn'), error: dispatch('error'), debug: dispatch('debug') };
}

function toDbosPayload(fields: object, message: string): object {
  return { ...fields, msg: message };
}

function logViaLiveKit(level: Level, fields: object, message: string, fallback: pino.Logger): void {
  try {
    log()[level](fields, message);
  } catch (err) {
    if (err instanceof TypeError) {
      fallback[level](fields, message);
    } else {
      throw err;
    }
  }
}

function buildPinoLogger(name: string): pino.Logger {
  const level = process.env.LOG_LEVEL ?? 'info';
  const transport = resolveTransport();
  return pino({ name, level, ...(transport ? { transport } : {}) });
}

function resolveTransport(): pino.TransportSingleOptions | undefined {
  const env = process.env.NODE_ENV;
  if (env === 'production') return productionTransport();
  if (env === 'development' || env === 'test') return prettyTransport();
  return undefined;
}

function productionTransport(): pino.TransportSingleOptions | undefined {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return undefined;
  return { target: 'pino-opentelemetry-transport' };
}

function prettyTransport(): pino.TransportSingleOptions {
  return { target: 'pino-pretty', options: { colorize: process.env.NODE_ENV !== 'test' } };
}
