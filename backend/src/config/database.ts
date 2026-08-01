// lapa-casa-hostel/backend/src/config/database.ts

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '@/utils/logger';

let pool: Pool;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}

export async function connectDatabase(): Promise<void> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('SELECT 1');
    logger.info('PostgreSQL conectado correctamente');
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const p = getPool();
  const result = await p.query<T>(text, params);
  const duration = Date.now() - start;
  logger.debug('Executed query', { text: text.substring(0, 80), duration, rows: result.rowCount });
  return result;
}

export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function disconnect(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info('PostgreSQL pool cerrado');
  }
}

export async function healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; latency?: number }> {
  try {
    const start = Date.now();
    await query('SELECT 1');
    return { status: 'healthy', latency: Date.now() - start };
  } catch {
    return { status: 'unhealthy' };
  }
}
