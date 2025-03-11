// src/lib/db.ts
import { Pool, PoolClient } from 'pg';
import { config } from '../config';
import { DatabaseError } from '../utils/errorHandler';

const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  max: config.database.maxConnections,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
});

// Add event listeners for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't crash the application, but log this critical error
});

// Helper function for parameterized queries
const query = async (text: string, params?: any[]) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    throw new DatabaseError(
      'Database query failed', 
      { query: text, params }, 
      error instanceof Error ? error : undefined
    );
  }
};

// Get a client from pool with automatic release
const withClient = async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
};

// Shutdown function
const shutdown = async () => {
  try {
    console.log('Closing database pool...');
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

export { pool, query, withClient, shutdown };