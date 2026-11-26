import { Router } from 'express';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { ax5dTemplate } from '../content/ax-5d.js';
import { env } from '../env.js';
import { db } from '../db/index.js';
import {
  announcements,
  feedbacks,
  missions,
  questions,
  screenStates,
  sessions,
  stages,
  submissions,
  teams
} from '../db/schema.js';
import { requireInstructor } from '../lib/auth.js';
import { buildAdminBundle, ensureScreenState, loadSessionData } from '../lib/bundle.js';
import { pickColor, uniqueCode } from '../lib/codes.js';
import { notifySession } from '../lib/realtime.js';
import { applyTemplate } from '../lib/template.js';
import { resetTimerFlag } from '../lib/timer.js';
import { adminExportRouter } from './admin-export.js';

export const adminRouter = Router();
adminRouter.use(requireInstructor);

async function getSession(sessionId: string) {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  return row ?? null;
}

async function sessionOr404(sessionId: string, res: import('express').Response) {
  const session = await getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: '교육 회차를 찾을 수 없습니다.' });
    return null;
  }
  return session;
}

adminRouter.get('/sessions', async (_req, res) => {
  const rows = await db.select().from(sessions).orderBy(desc(sessions.createdAt));
  const teamCounts = await db
    .select({ sessionId: teams.sessionId, n: count() })
    .from(teams)
    .groupBy(teams.sessionId);

  res.json({
    sessions: rows.map((s) => ({
      id: s.id,
      title: s.title,
      joinCode: s.joinCode,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      teamCount: Number(teamCounts.find((t) => t.sessionId === s.id)?.n ?? 0)
    }))
  });
});

const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  teamNames: z.array(z.string().trim().min(1).max(24)).max(60).optional(),
  withTemplate: z.boolean().optional()
});

adminRouter.post('/sessions', async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: '교육 이름을 입력해주세요.' });
    return;
  }

  const joinCode = await uniqueCode(async (code) => {
    const [row] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.joinCode, code));
    return !!row;
  });

  const [session] = await db
    .insert(sessions)
    .values({ title: parsed.data.title, joinCode, status: 'draft' })
    .returning();

  const template = parsed.data.withTemplate === false ? null : ax5dTemplate;
  if (template) {
    await applyTemplate(session.id, template);
  } else {
    await db.insert(screenStates).values({ sessionId: session.id }).onConflictDoNothing();
  }

  const names = parsed.data.teamNames ?? [];
  if (names.length) {
    await db.insert(teams).values(
      names.map((name, index) => ({
        sessionId: session.id,
        name,
        color: pickColor(index)
      }))
    );
  }

  const data = await loadSessionData(session.id);
  res.status(201).json({ ok: true, session: { id: session.id, joinCode }, bundle: data ? buildAdminBundle(data) : null });
});

/* applyTemplate 은 src/lib/template.ts 로 이동 */

adminRouter.get('/sessions/:sessionId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  if (!session) return;
  const data = await loadSessionData(session.id);
  if (!data) {
    res.status(404).json({ error: '교육 정보를 불러올 수 없습니다.' });
    return;
  }
  const base = env.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
  res.json({
    ...buildAdminBundle(data),
    joinUrl: `${base}/join?code=${session.joinCode}`,
    screenUrl: `${base}/screen/${session.joinCode}`
  });
});

const patchSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['draft', 'live', 'closed']).optional()
});

adminRouter.patch('/sessions/:sessionId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = patchSessionSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '수정할 값을 확인해주세요.' });
    return;
  }
  await db.update(sessions).set(parsed.data).where(eq(sessions.id, session.id));
  notifySession(session.id);
  res.json({ ok: true });
});

adminRouter.delete('/sessions/:sessionId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  if (!session) return;
  await db.delete(sessions).where(eq(sessions.id, session.id));
  res.json({ ok: true });
});

const contentSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  stages: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        goal: z.string().optional(),
        timeLimitSec: z.number().int().min(10).max(7200).optional(),
        missions: z
          .array(
            z.object({
              title: z.string().optional(),
              prompt: z.string().min(1),
              inputType: z.enum(['text', 'longtext', 'choice', 'number', 'url', 'file']).optional(),
              options: z.array(z.string()).optional(),
              maxLen: z.number().int().min(10).max(20000).optional(),
              allowEdit: z.boolean().optional(),
              required: z.boolean().optional()
            })
          )
          .optional(),
        slides: z
          .array(
            z.object({
              type: z.enum(['markdown', 'image', 'url']).optional(),
              content: z.string(),
              notes: z.string().optional()
            })
          )
          .optional()
      })
    )
    .min(1)
});

/** 5단계 콘텐츠를 통째로 교체 (기존 단계/미션/제출물은 삭제됨) */
adminRouter.post('/sessions/:sessionId/content', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = contentSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '콘텐츠 형식을 확인해주세요.' });
    return;
  }
  await applyTemplate(session.id, {
    title: parsed.data.title ?? session.title,
    stages: parsed.data.stages.map((stage) => ({
      title: stage.title,
      goal: stage.goal ?? '',
      timeLimitSec: stage.timeLimitSec ?? 600,
      missions: (stage.missions ?? []).map((m) => ({
        title: m.title ?? '',
        prompt: m.prompt,
        inputType: m.inputType ?? 'longtext',
        options: m.options ?? [],
        maxLen: m.maxLen ?? 2000,
        allowEdit: m.allowEdit ?? true,
        required: m.required ?? true
      })),
      slides: (stage.slides ?? []).map((s) => ({
        type: s.type ?? 'markdown',
        content: s.content,
        notes: s.notes ?? ''
      }))
    }))
  });
  if (parsed.data.title) {
    await db.update(sessions).set({ title: parsed.data.title }).where(eq(sessions.id, session.id));
  }
  notifySession(session.id);
  res.json({ ok: true });
});

const createTeamsSchema = z.object({
  names: z.array(z.string().trim().min(1).max(24)).min(1).max(60)
});

adminRouter.post('/sessions/:sessionId/teams', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = createTeamsSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '조 이름을 확인해주세요.' });
    return;
  }
  const existing = await db.select().from(teams).where(eq(teams.sessionId, session.id));
  const existingNames = new Set(existing.map((t) => t.name));
  const fresh = parsed.data.names.filter((name) => !existingNames.has(name));
  if (!fresh.length) {
    res.status(409).json({ error: '이미 존재하는 조 이름입니다.' });
    return;
  }
  await db.insert(teams).values(
    fresh.map((name, index) => ({
      sessionId: session.id,
      name,
      color: pickColor(existing.length + index)
    }))
  );
  notifySession(session.id);
  res.json({ ok: true, created: fresh.length });
});

const patchTeamSchema = z.object({
  name: z.string().trim().min(1).max(24).optional(),
  members: z.string().trim().max(160).optional(),
  color: z.string().trim().min(1).max(20).optional()
});

adminRouter.patch('/sessions/:sessionId/teams/:teamId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = patchTeamSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '조 정보를 확인해주세요.' });
    return;
  }
  await db
    .update(teams)
    .set(parsed.data)
    .where(and(eq(teams.id, req.params.teamId), eq(teams.sessionId, session.id)));
  notifySession(session.id);
  res.json({ ok: true });
});

adminRouter.delete('/sessions/:sessionId/teams/:teamId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  if (!session) return;
  await db
    .delete(teams)
    .where(and(eq(teams.id, req.params.teamId), eq(teams.sessionId, session.id)));
  notifySession(session.id);
  res.json({ ok: true });
});

/** 연습용: 제출물과 질문 초기화 */
adminRouter.post('/sessions/:sessionId/reset-submissions', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  if (!session) return;
  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.sessionId, session.id));
  const teamIds = teamRows.map((t) => t.id);
  if (teamIds.length) {
    await db.delete(submissions).where(inArray(submissions.teamId, teamIds));
  }
  await db.delete(questions).where(eq(questions.sessionId, session.id));
  notifySession(session.id);
  res.json({ ok: true });
});

const patchStageSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  goal: z.string().max(1000).optional(),
  timeLimitSec: z.number().int().min(10).max(7200).optional(),
  state: z.enum(['locked', 'open', 'review', 'closed']).optional()
});

adminRouter.patch('/sessions/:sessionId/stages/:stageId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = patchStageSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '단계 정보를 확인해주세요.' });
    return;
  }
  const [stage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, req.params.stageId), eq(stages.sessionId, session.id)));
  if (!stage) {
    res.status(404).json({ error: '단계를 찾을 수 없습니다.' });
    return;
  }

  const patch = parsed.data;
  await ensureScreenState(session.id);

  if (patch.state === 'open') {
    await db
      .update(stages)
      .set({ state: 'closed' })
      .where(and(eq(stages.sessionId, session.id), eq(stages.state, 'open')));
  }

  const [updated] = await db
    .update(stages)
    .set(patch)
    .where(eq(stages.id, stage.id))
    .returning();

  if (patch.state === 'open') {
    const [firstMission] = await db
      .select()
      .from(missions)
      .where(eq(missions.stageId, stage.id))
      .orderBy(asc(missions.seq))
      .limit(1);

    await db
      .update(screenStates)
      .set({
        mode: 'mission',
        activeStageId: stage.id,
        activeMissionId: firstMission?.id ?? null,
        reviewSubmissionId: null,
        reviewIndex: 0,
        updatedAt: new Date()
      })
      .where(eq(screenStates.sessionId, session.id));
  }

  notifySession(session.id);
  res.json({ ok: true, stage: updated });
});

const screenPatchSchema = z.object({
  mode: z.enum(['idle', 'stage_intro', 'mission', 'lecture', 'review', 'scoreboard']).optional(),
  activeStageId: z.string().nullable().optional(),
  activeMissionId: z.string().nullable().optional(),
  reviewSubmissionId: z.string().nullable().optional(),
  reviewIndex: z.number().int().min(0).optional(),
  slideIndex: z.number().int().min(0).optional(),
  revealTeams: z.boolean().optional()
});

adminRouter.patch('/sessions/:sessionId/screen', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = screenPatchSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '화면 설정을 확인해주세요.' });
    return;
  }

  const current = await ensureScreenState(session.id);
  const body = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (body.mode !== undefined) patch.mode = body.mode;
  if (body.revealTeams !== undefined) patch.revealTeams = body.revealTeams;
  if (body.reviewIndex !== undefined) patch.reviewIndex = body.reviewIndex;
  if (body.slideIndex !== undefined) patch.slideIndex = body.slideIndex;
  if (body.activeStageId !== undefined) patch.activeStageId = body.activeStageId;
  if (body.activeMissionId !== undefined) patch.activeMissionId = body.activeMissionId;
  if (body.reviewSubmissionId !== undefined) patch.reviewSubmissionId = body.reviewSubmissionId;

  if (body.activeMissionId) {
    const [mission] = await db.select().from(missions).where(eq(missions.id, body.activeMissionId));
    if (mission) patch.activeStageId = mission.stageId;
  }

  const missionIdForReview =
    body.activeMissionId ?? current.activeMissionId ?? null;

  const submittedList = async (missionId: string) =>
    db
      .select()
      .from(submissions)
      .where(and(eq(submissions.missionId, missionId), eq(submissions.status, 'submitted')))
      .orderBy(asc(submissions.submittedAt));

  if (body.mode === 'review' && body.reviewSubmissionId === undefined && missionIdForReview) {
    const list = await submittedList(missionIdForReview);
    const pick = list[body.reviewIndex ?? 0] ?? list[0] ?? null;
    patch.reviewSubmissionId = pick?.id ?? null;
    patch.reviewIndex = pick ? list.findIndex((s) => s.id === pick.id) : 0;
  }

  if (
    body.reviewSubmissionId &&
    body.reviewIndex === undefined &&
    missionIdForReview
  ) {
    const list = await submittedList(missionIdForReview);
    const idx = list.findIndex((s) => s.id === body.reviewSubmissionId);
    if (idx >= 0) patch.reviewIndex = idx;
  }

  await db.update(screenStates).set(patch).where(eq(screenStates.sessionId, session.id));
  notifySession(session.id);
  res.json({ ok: true });
});

const timerSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'reset', 'set']),
  seconds: z.number().int().min(5).max(7200).optional()
});

adminRouter.post('/sessions/:sessionId/timer', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = timerSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '타이머 설정을 확인해주세요.' });
    return;
  }

  const current = await ensureScreenState(session.id);
  const now = Date.now();
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  const remainingNow = (): number | null => {
    if (current.timerRunning && current.timerEndsAt) {
      return Math.max(0, Math.round((current.timerEndsAt.getTime() - now) / 1000));
    }
    return current.timerRemainingSec ?? null;
  };

  switch (parsed.data.action) {
    case 'start': {
      const seconds = parsed.data.seconds ?? 600;
      patch.timerRunning = true;
      patch.timerEndsAt = new Date(now + seconds * 1000);
      patch.timerRemainingSec = null;
      break;
    }
    case 'resume': {
      const seconds = remainingNow() ?? parsed.data.seconds ?? 600;
      patch.timerRunning = true;
      patch.timerEndsAt = new Date(now + seconds * 1000);
      patch.timerRemainingSec = null;
      break;
    }
    case 'pause': {
      patch.timerRunning = false;
      patch.timerEndsAt = null;
      patch.timerRemainingSec = remainingNow() ?? 0;
      break;
    }
    case 'reset': {
      patch.timerRunning = false;
      patch.timerEndsAt = null;
      patch.timerRemainingSec = null;
      break;
    }
    default: {
      patch.timerRunning = false;
      patch.timerEndsAt = null;
      patch.timerRemainingSec = parsed.data.seconds ?? 600;
      break;
    }
  }

  await db.update(screenStates).set(patch).where(eq(screenStates.sessionId, session.id));
  resetTimerFlag(session.id);
  notifySession(session.id);
  res.json({ ok: true });
});

const feedbackSchema = z.object({
  body: z.string().max(1000).optional(),
  score: z.number().int().min(0).max(100).nullable().optional(),
  isStar: z.boolean().optional(),
  visibleToTeam: z.boolean().optional()
});

adminRouter.post('/sessions/:sessionId/submissions/:submissionId/feedback', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = feedbackSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '피드백 내용을 확인해주세요.' });
    return;
  }

  const [target] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .innerJoin(teams, eq(teams.id, submissions.teamId))
    .where(
      and(eq(submissions.id, req.params.submissionId), eq(teams.sessionId, session.id))
    );

  if (!target) {
    res.status(404).json({ error: '제출물을 찾을 수 없습니다.' });
    return;
  }

  const [row] = await db
    .insert(feedbacks)
    .values({
      submissionId: target.id,
      body: parsed.data.body ?? '',
      score: parsed.data.score ?? null,
      isStar: parsed.data.isStar ?? false,
      visibleToTeam: parsed.data.visibleToTeam ?? true
    })
    .returning();

  notifySession(session.id);
  res.status(201).json({
    ok: true,
    feedback: {
      id: row.id,
      body: row.body,
      score: row.score,
      isStar: row.isStar,
      visibleToTeam: row.visibleToTeam,
      createdAt: row.createdAt.toISOString()
    }
  });
});

adminRouter.delete('/sessions/:sessionId/feedbacks/:feedbackId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  if (!session) return;

  const [row] = await db
    .select({ id: feedbacks.id })
    .from(feedbacks)
    .innerJoin(submissions, eq(submissions.id, feedbacks.submissionId))
    .innerJoin(teams, eq(teams.id, submissions.teamId))
    .where(and(eq(feedbacks.id, req.params.feedbackId), eq(teams.sessionId, session.id)));

  if (!row) {
    res.status(404).json({ error: '피드백을 찾을 수 없습니다.' });
    return;
  }
  await db.delete(feedbacks).where(eq(feedbacks.id, row.id));
  notifySession(session.id);
  res.json({ ok: true });
});

const announcementSchema = z.object({
  body: z.string().trim().min(1).max(500),
  pinned: z.boolean().optional()
});

adminRouter.post('/sessions/:sessionId/announcements', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = announcementSchema.safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '공지 내용을 입력해주세요.' });
    return;
  }
  const [row] = await db
    .insert(announcements)
    .values({
      sessionId: session.id,
      body: parsed.data.body,
      pinned: parsed.data.pinned ?? false
    })
    .returning();
  notifySession(session.id);
  res.status(201).json({
    ok: true,
    announcement: {
      id: row.id,
      body: row.body,
      pinned: row.pinned,
      createdAt: row.createdAt.toISOString()
    }
  });
});

adminRouter.delete('/sessions/:sessionId/announcements/:announcementId', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  if (!session) return;
  await db
    .delete(announcements)
    .where(
      and(
        eq(announcements.id, req.params.announcementId),
        eq(announcements.sessionId, session.id)
      )
    );
  notifySession(session.id);
  res.json({ ok: true });
});

adminRouter.post('/sessions/:sessionId/questions/:questionId/answer', async (req, res) => {
  const session = await sessionOr404(req.params.sessionId, res);
  const parsed = z.object({ answer: z.string().trim().min(1).max(1000) }).safeParse(req.body);
  if (!session) return;
  if (!parsed.success) {
    res.status(400).json({ error: '답변을 입력해주세요.' });
    return;
  }
  await db
    .update(questions)
    .set({ answer: parsed.data.answer, status: 'answered' })
    .where(
      and(eq(questions.id, req.params.questionId), eq(questions.sessionId, session.id))
    );
  notifySession(session.id);
  res.json({ ok: true });
});

adminRouter.use(adminExportRouter);





