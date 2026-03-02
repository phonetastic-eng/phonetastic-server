import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

function buildUrl(): string {
  const user = process.env.DB_USER ?? 'postgres';
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST ?? '127.0.0.1';
  const port = process.env.DB_PORT ?? '5432';
  const database = process.env.DB_DATABASE ?? 'phonetastic_dev';
  const auth = password ? `${user}:${password}` : user;
  return `postgresql://${auth}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: buildUrl(),
  },
  verbose: true,
  strict: true,
});
