import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { z } from 'zod';
import { db } from '../db/index.js';
import { sessions, teams, type SessionRow } from '../db/schema.js';
import { env } from '../env.js';
import { setAuthCookie, signToken, TEAM_COOKIE } from '../lib/auth.js';
import { buildScreenBundle, loadSessionData } from '../lib/bundle.js';
import { pickColor } from '../lib/codes.js';
import { notifySession } from '../lib/realtime.js';

export const publicRouter = Router();

async function findSessionByCode(code: string): Promise<SessionRow | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const [row] = await db.select().from(sessions).where(eq(sessions.joinCode, normalized));
  return row ?? null;
}

function sessionView(session: SessionRow) {
  return {
    id: session.id,
    title: session.title,
    joinCode: session.joinCode,
    status: session.status
  };
}

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

/** 메인 화면 QR 용 PNG 생성 */
publicRouter.get('/qr', async (req, res) => {
  const data = typeof req.query.data === 'string' ? req.query.data : '';
  if (!data) {
    res.status(400).json({ error: 'data 파라미터가 필요합니다.' });
    return;
  }
  try {
    const buffer = await QRCode.toBuffer(data, {
      margin: 1,
      width: 512,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' }
    });
    res.type('png').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
  } catch (err) {
    console.error('[qr]', err);
    res.status(500).json({ error: 'QR 생성에 실패했습니다.' });
  }
});

/** 교육생 입장 화면용: 코드로 교육 정보 + 조 목록 조회 */
publicRouter.get('/session/:joinCode', async (req, res) => {
  const session = await findSessionByCode(req.params.joinCode ?? '');
  if (!session) {
    res.status(404).json({ error: '입장 코드를 확인해주세요.' });
    return;
  }
  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.sessionId, session.id))
    .orderBy(asc(teams.createdAt));

  res.json({
    session: sessionView(session),
    teams: teamRows.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      members: t.members
    }))
  });
});

const joinSchema = z.object({
  joinCode: z.string().min(4).max(12),
  teamId: z.string().min(1).optional(),
  teamName: z.string().trim().min(1).max(24).optional(),
  members: z.string().trim().max(160).optional()
});

/** 교육생 입장: 조 선택 또는 새 조 생성 후 팀 쿠키 발급 */
publicRouter.post('/join', async (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '입장 정보를 확인해주세요.' });
    return;
  }
  const { joinCode, teamId, teamName, members } = parsed.data;

  const session = await findSessionByCode(joinCode);
  if (!session) {
    res.status(404).json({ error: '입장 코드를 확인해주세요.' });
    return;
  }
  if (session.status === 'closed') {
    res.status(409).json({ error: '이미 종료된 교육입니다.' });
    return;
  }

  let team: typeof teams.$inferSelect | null = null;

  if (teamId) {
    const [found] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.sessionId, session.id)));
    team = found ?? null;
    if (!team) {
      res.status(404).json({ error: '조를 찾을 수 없습니다.' });
      return;
    }
  } else if (teamName) {
    const [existing] = await db
      .select()
      .from(teams)
      .where(and(eq(teams.sessionId, session.id), eq(teams.name, teamName)));
    if (existing) {
      team = existing;
    } else {
      const current = await db.select().from(teams).where(eq(teams.sessionId, session.id));
      const [created] = await db
        .insert(teams)
        .values({
          sessionId: session.id,
          name: teamName,
          color: pickColor(current.length),
          members: members ?? ''
        })
        .returning();
      team = created;
      notifySession(session.id);
    }
  } else {
    res.status(400).json({ error: '조를 선택하거나 조 이름을 입력해주세요.' });
    return;
  }

  setAuthCookie(
    res,
    TEAM_COOKIE,
    signToken({
      role: 'team',
      teamId: team.id,
      sessionId: session.id,
      teamName: team.name
    })
  );

  res.json({ ok: true, team: { id: team.id, name: team.name, color: team.color } });
});

/** 메인 화면(프로젝터)용 공개 데이터 */
publicRouter.get('/screen/:joinCode', async (req, res) => {
  const session = await findSessionByCode(req.params.joinCode ?? '');
  if (!session) {
    res.status(404).json({ error: '입장 코드를 확인해주세요.' });
    return;
  }
  const data = await loadSessionData(session.id);
  if (!data) {
    res.status(404).json({ error: '교육 정보를 불러올 수 없습니다.' });
    return;
  }

  const base = env.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
  const bundle = buildScreenBundle(data);

  res.json({
    ...bundle,
    joinUrl: `${base}/join?code=${session.joinCode}`,
    screenUrl: `${base}/screen/${session.joinCode}`,
    baseUrl: base
  });
});
