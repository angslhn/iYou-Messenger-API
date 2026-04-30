import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Mendapatkan instance Pool PostgreSQL untuk environment Serverless.
 */
export function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,

      // Berikan toleransi 10 detik agar Neon punya waktu untuk cold start
      connectionTimeoutMillis: 10_000,

      // Neon mewajibkan SSL, jadi set agar selalu aktif
      ssl: {
        rejectUnauthorized: true,
      },
    });

    pool.on('error', (err) => {
      console.error('Unexpected database error in serverless pool: ', err);
    });
  }

  return pool;
}
