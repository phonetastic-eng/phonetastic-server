import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config/env.js';

async function runMigrations() {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  const url = `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;

  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  await client.end();
}

runMigrations().catch(console.error);
