import pino from 'pino';
import { log } from '@livekit/agents';
import { DBOS } from '@dbos-inc/dbos-sdk';

/**
 * Unified structured logger interface satisfied by all three backends.
 *
 * @param fields - Structured context fields attached to the log record.
 * @param message - Human-readable log message.
 */
export interface Logger {
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
  error(fields: object, message: string): void;
  debug(fields: object, message: string): void;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

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
  const dispatch = (level: Level) => (fields: object, message: string) =>
    logViaLiveKit(level, fields, message, fallback);
  return { info: dispatch('info'), warn: dispatch('warn'), error: dispatch('error'), debug: dispatch('debug') };
}

function buildServerLogger(pinoLogger: pino.Logger): Logger {
  const dispatch = (level: Level) => (fields: object, message: string) => {
    try {
      if (DBOS.isWithinWorkflow()) return DBOS.logger[level](toDbosPayload(fields, message));
    } catch { /* not in DBOS context */ }
    pinoLogger[level](fields, message);
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
