import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../config/env.js';
import * as schema from './schema/index.js';

/**
 * Creates a Drizzle ORM database client.
 *
 * @param connectionString - Optional override for the database URL.
 * @returns A configured Drizzle database instance with schema bindings.
 */
export function createDb(connectionString?: string) {
  const url = connectionString ?? buildConnectionString();
  const client = postgres(url);
  return drizzle(client, { schema });
}

function buildConnectionString(): string {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_DATABASE } = env;
  const auth = DB_PASSWORD ? `${DB_USER}:${DB_PASSWORD}` : DB_USER;
  return `postgresql://${auth}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
}

export type Database = ReturnType<typeof createDb>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
