import pino from 'pino';
import { log } from '@livekit/agents';
import { DBOS } from '@dbos-inc/dbos-sdk';

/** Unified structured logger interface satisfied by all three backends. */
export interface Logger {
  info(fields: object, message: string): void;
  warn(fields: object, message: string): void;
  error(fields: object, message: string): void;
  debug(fields: object, message: string): void;
}

type Level = 'info' | 'warn' | 'error' | 'debug';

let IS_LIVEKIT_AGENT = false;

/**
 * Marks the current process as a LiveKit agent.
 * Call once at the top of `agent.ts` before any log call.
 * The flag is process-scoped and irreversible.
 *
 * @postcondition All subsequent facade log calls route to the LiveKit backend.
 */
export function markAsLiveKitAgent(): void {
  IS_LIVEKIT_AGENT = true;
}

/**
 * Resets the LiveKit agent flag. For testing only.
 * @internal
 */
export function _resetForTesting(): void {
  IS_LIVEKIT_AGENT = false;
}

/**
 * Creates a named logger that routes each call to the correct backend at call time.
 *
 * - LiveKit backend: when {@link markAsLiveKitAgent} has been called.
 * - DBOS backend: when inside a DBOS workflow, step, or transaction.
 * - Pino backend: all other cases.
 *
 * @param name - Identifier that appears in Pino log records (e.g. `"call-service"`).
 * @returns A {@link Logger} that dispatches to the correct backend per call.
 */
export function createLogger(name: string): Logger {
  const pinoLogger = buildPinoLogger(name);
  const dispatch = (level: Level) => (fields: object, message: string) => {
    const backend = selectBackend();
    if (backend === 'livekit') return logViaLiveKit(level, fields, message, pinoLogger);
    if (backend === 'dbos') return DBOS.logger[level](toDbosPayload(fields, message));
    pinoLogger[level](fields, message);
  };
  return { info: dispatch('info'), warn: dispatch('warn'), error: dispatch('error'), debug: dispatch('debug') };
}

function selectBackend(): 'livekit' | 'dbos' | 'pino' {
  if (IS_LIVEKIT_AGENT) return 'livekit';
  try {
    return DBOS.isWithinWorkflow() ? 'dbos' : 'pino';
  } catch {
    return 'pino';
  }
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
