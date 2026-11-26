import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../env.js';
import * as schema from './schema.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10
});

pool.on('error', (err) => {
  console.error('[pg] unexpected pool error', err);
});

export const db = drizzle(pool, { schema });
export { schema };
