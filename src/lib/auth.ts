import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export const INSTRUCTOR_COOKIE = 'ts_instructor';
export const TEAM_COOKIE = 'ts_team';

export type InstructorToken = { role: 'instructor'; name: string };
export type TeamToken = { role: 'team'; teamId: string; sessionId: string; teamName: string };
export type AnyToken = InstructorToken | TeamToken;

const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

export function signToken(payload: AnyToken): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken<T extends AnyToken>(token: string | undefined): T | null {
  if (!token) return null;
  try {
    return jwt.verify(token, env.jwtSecret) as T;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, name: string, token: string): void {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
    maxAge: MAX_AGE_MS
  });
}

export function clearAuthCookie(res: Response, name: string): void {
  res.clearCookie(name, { path: '/' });
}

function bearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return undefined;
}

export function readInstructor(req: Request): InstructorToken | null {
  const token = req.cookies?.[INSTRUCTOR_COOKIE] ?? bearer(req);
  const payload = verifyToken<InstructorToken>(token);
  return payload?.role === 'instructor' ? payload : null;
}

export function readTeam(req: Request): TeamToken | null {
  const token = req.cookies?.[TEAM_COOKIE];
  const payload = verifyToken<TeamToken>(token);
  return payload?.role === 'team' ? payload : null;
}

export function requireInstructor(req: Request, res: Response, next: NextFunction): void {
  if (!readInstructor(req)) {
    res.status(401).json({ error: '강사 로그인이 필요합니다.' });
    return;
  }
  next();
}

export function requireTeam(req: Request, res: Response, next: NextFunction): void {
  if (!readTeam(req)) {
    res.status(401).json({ error: '조 참여 세션이 만료되었습니다. 다시 입장해주세요.' });
    return;
  }
  next();
}
