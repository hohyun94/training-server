import 'dotenv/config';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { pool } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { env } from './env.js';
import { initRealtime } from './lib/realtime.js';
import { startTimerLoop } from './lib/timer.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { playRouter } from './routes/play.js';
import { publicRouter } from './routes/public.js';

if (process.env.RUN_MIGRATIONS !== 'false') {
  /** DB 컨테이너가 늦게 뜨는 경우가 많아 부팅 시 몇 번 재시도한다. */
  const migrateWithRetry = async (attempts = 10, delayMs = 3000): Promise<void> => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await runMigrations();
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (attempt === attempts) throw err;
        console.error(`[server] 마이그레이션 실패 (${attempt}/${attempts}) — 3초 후 재시도: ${message}`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  };

  try {
    await migrateWithRetry();
  } catch (err) {
    console.error('[server] 마이그레이션 실패로 시작할 수 없습니다.', err);
    await pool.end();
    process.exit(1);
  }
}

const app = express();

app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(path.resolve(env.uploadDir), { maxAge: '7d' }));

app.use('/api/auth', authRouter);
app.use('/api/public', publicRouter);
app.use('/api/play', playRouter);
app.use('/api/admin', adminRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API 경로를 찾을 수 없습니다.' });
});

const publicDir = path.resolve('dist/public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[error]', err);
  const message =
    err instanceof Error && err.message.includes('File too large')
      ? '파일 용량이 너무 큽니다. (최대 20MB)'
      : '서버 오류가 발생했습니다.';
  res.status(500).json({ error: message });
});

const server = http.createServer(app);
initRealtime(server);
const timer = startTimerLoop();

server.listen(env.port, () => {
  console.log(`[server] listening on http://localhost:${env.port}`);
  console.log(`[server] static dir: ${publicDir} (exists: ${fs.existsSync(publicDir)})`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, shutting down`);
  clearInterval(timer);
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
