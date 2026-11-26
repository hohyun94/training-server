import 'dotenv/config';

function fallback(name: string, value: string): string {
  const resolved = process.env[name] ?? value;
  if (!resolved) throw new Error(`환경변수 ${name} 값이 필요합니다.`);
  return resolved;
}

export const env = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: fallback(
    'DATABASE_URL',
    'postgres://training:training@127.0.0.1:5434/training'
  ),
  adminPassword: fallback('ADMIN_PASSWORD', 'letmein'),
  jwtSecret: fallback('JWT_SECRET', 'dev-secret-please-change'),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? '').replace(/\/+$/, ''),
  uploadDir: process.env.UPLOAD_DIR ?? 'data/uploads',
  isProd: process.env.NODE_ENV === 'production'
};

export type Env = typeof env;
