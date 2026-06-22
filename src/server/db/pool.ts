import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

if (!config.databaseUrl) {
  // We don't throw here so the process can still boot for static/dev inspection,
  // but any query will fail clearly.
  console.warn('[db] DATABASE_URL is not set — database features will fail until configured.');
}

export const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  // Neon requires SSL; allow self-signed chain.
  ssl: config.databaseUrl.includes('neon.tech') || config.isProd
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}
