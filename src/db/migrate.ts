import fs from 'node:fs';
import path from 'node:path';
import { pool } from './index.js';

const MIGRATIONS_DIR = path.resolve('drizzle');

/**
 * drizzle-kit generate 로 만든 SQL 파일을 순서대로 적용한다.
 * 별도 CLI 없이 컨테이너 시작 시 자동 마이그레이션이 가능하도록 자체 기록 테이블을 사용.
 */
export async function runMigrations(): Promise<void> {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.warn('[migrate] drizzle 폴더가 없어 마이그레이션을 건너뜁니다.');
    return;
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (!files.length) return;

  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists __app_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query<{ id: string }>('select id from __app_migrations');
    const applied = new Set(rows.map((row) => row.id));

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter(Boolean);

      await client.query('begin');
      try {
        for (const statement of statements) {
          await client.query(statement);
        }
        await client.query('insert into __app_migrations (id) values ($1)', [file]);
        await client.query('commit');
        console.log(`[migrate] applied ${file}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`마이그레이션 실패 (${file}): ${(err as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
}
