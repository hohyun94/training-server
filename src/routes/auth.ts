import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import {
  clearAuthCookie,
  INSTRUCTOR_COOKIE,
  readInstructor,
  setAuthCookie,
  signToken
} from '../lib/auth.js';

export const authRouter = Router();

const loginSchema = z.object({ password: z.string().min(1) });

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }
  if (parsed.data.password !== env.adminPassword) {
    res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    return;
  }
  setAuthCookie(
    res,
    INSTRUCTOR_COOKIE,
    signToken({ role: 'instructor', name: 'instructor' })
  );
  res.json({ ok: true });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res, INSTRUCTOR_COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ instructor: !!readInstructor(req) });
});
