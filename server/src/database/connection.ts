import { pool } from '../db';

export const connectDB = async (): Promise<void> => {
  // Postgres pool connects lazily — verify connectivity and surface config errors at boot.
  try {
    const r = await pool.query('SELECT 1 AS ok');
    if (!r.rows[0]) throw new Error('no response');
  } catch (err) {
    throw new Error(`[pg] could not connect to Postgres: ${(err as Error).message}`, { cause: err });
  }
};

export const disconnectDB = async (): Promise<void> => {
  await pool.end();
};