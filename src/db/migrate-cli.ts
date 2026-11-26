import { pool } from './index.js';
import { runMigrations } from './migrate.js';

await runMigrations()
  .then(() => {
    console.log('[migrate] done');
  })
  .catch((err) => {
    console.error('[migrate] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
