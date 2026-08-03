// lapa-casa-hostel/backend/src/config/database.ts

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../utils/logger';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required (see backend/.env)');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),
  idleTimeoutMillis: 30000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
});

export const query = <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> =>
  pool.query<T>(text, params);

export const getClient = (): Promise<PoolClient> => pool.connect();

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const testConnection = async (): Promise<boolean> => {
  try {
    await pool.query('SELECT 1');
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed', { error });
    return false;
  }
};

export const disconnect = async (): Promise<void> => {
  await pool.end();
  logger.info('Database pool closed');
};

export const connectDatabase = async (): Promise<void> => {
  await testConnection();
};

export default pool;
