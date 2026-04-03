import { type JobContext, type JobProcess, defineAgent, ServerOptions, cli } from '@livekit/agents';
import 'dotenv/config';
import { setupContainer, container } from './config/container.js';
import { env } from './config/env.js';
import { createLogger } from './lib/logger.js';
import { CallEntryHandlerFactory } from './agent/call-entry-handler.js';

const logger = createLogger('agent');

export type SessionData = {
  companyId: number | undefined;
  userId: number | undefined;
  botId: number | undefined;
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    logger.info({}, 'Prewarm started');
    setupContainer();
    logger.info({}, 'Prewarm complete');
  },
  entry: async (ctx: JobContext) => {
    const handler = await container.resolve<CallEntryHandlerFactory>('CallEntryHandlerFactory').create(ctx);
    await handler.handle();
  },
});

cli.runApp(new ServerOptions({
  agent: __filename,
  agentName: env.AGENT_NAME,
  wsURL: env.LIVEKIT_URL!,
  apiKey: env.LIVEKIT_API_KEY,
  apiSecret: env.LIVEKIT_API_SECRET,
}));
