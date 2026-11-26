import fs from 'node:fs';
import path from 'node:path';
import { Router, type Request } from 'express';
import { and, eq } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../db/index.js';
import { missions, questions, stages, submissions, votes } from '../db/schema.js';
import { env } from '../env.js';
import { readTeam, requireTeam, type TeamToken } from '../lib/auth.js';
import { buildPlayBundle, loadSessionData } from '../lib/bundle.js';
import { notifySession } from '../lib/realtime.js';

export const playRouter = Router();

function teamOf(req: Request): TeamToken | null {
  return readTeam(req);
}

playRouter.get('/state', requireTeam, async (req, res) => {
  const team = teamOf(req);
  if (!team) {
    res.status(401).json({ error: '다시 입장해주세요.' });
    return;
  }
  const data = await loadSessionData(team.sessionId);
  if (!data) {
    res.status(404).json({ error: '교육 정보를 찾을 수 없습니다.' });
    return;
  }
  const bundle = buildPlayBundle(data, team.teamId);
  if (!bundle) {
    res.status(404).json({ error: '조 정보를 찾을 수 없습니다. 다시 입장해주세요.' });
    return;
  }
  res.json(bundle);
});

const submitSchema = z.object({
  missionId: z.string().min(1),
  content: z.string().max(20000).optional(),
  fileUrl: z.string().max(500).nullable().optional(),
  fileName: z.string().max(200).nullable().optional(),
  submit: z.boolean().optional()
});

playRouter.put('/submission', requireTeam, async (req, res) => {
  const team = teamOf(req);
  const parsed = submitSchema.safeParse(req.body);
  if (!team) {
    res.status(401).json({ error: '다시 입장해주세요.' });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: '제출 내용을 확인해주세요.' });
    return;
  }

  const { missionId, content, fileUrl, fileName, submit } = parsed.data;

  const [mission] = await db.select().from(missions).where(eq(missions.id, missionId));
  if (!mission) {
    res.status(404).json({ error: '미션을 찾을 수 없습니다.' });
    return;
  }
  const [stage] = await db.select().from(stages).where(eq(stages.id, mission.stageId));
  if (!stage || stage.sessionId !== team.sessionId) {
    res.status(403).json({ error: '이 미션에 접근할 수 없습니다.' });
    return;
  }
  if (stage.state !== 'open') {
    res
      .status(409)
      .json({ error: '지금은 제출할 수 없는 단계입니다. 강사의 안내를 기다려주세요.' });
    return;
  }

  const [existing] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.missionId, missionId), eq(submissions.teamId, team.teamId)));

  if (existing?.status === 'submitted' && !mission.allowEdit) {
    res.status(409).json({ error: '이 미션은 수정이 불가능합니다. 강사에게 문의해주세요.' });
    return;
  }

  const text = (content ?? '').trim();
  const hasFile = !!(fileUrl ?? existing?.fileUrl);
  if (mission.required && submit && !text && !hasFile) {
    res.status(400).json({ error: '답안을 입력한 뒤 제출해주세요.' });
    return;
  }

  const now = new Date();
  const nextStatus = submit ? 'submitted' : existing?.status === 'submitted' ? 'submitted' : 'draft';

  const values = {
    missionId,
    teamId: team.teamId,
    content: content ?? existing?.content ?? '',
    fileUrl: fileUrl ?? existing?.fileUrl ?? null,
    fileName: fileName ?? existing?.fileName ?? null,
    status: nextStatus,
    submittedAt: submit ? now : existing?.submittedAt ?? null,
    updatedAt: now
  };

  const [row] = await db
    .insert(submissions)
    .values(values)
    .onConflictDoUpdate({
      target: [submissions.missionId, submissions.teamId],
      set: {
        content: values.content,
        fileUrl: values.fileUrl,
        fileName: values.fileName,
        status: values.status,
        submittedAt: values.submittedAt,
        updatedAt: now
      }
    })
    .returning();

  notifySession(team.sessionId);

  res.json({
    ok: true,
    submission: {
      id: row.id,
      status: row.status,
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null
    }
  });
});

playRouter.post('/question', requireTeam, async (req, res) => {
  const team = teamOf(req);
  const parsed = z.object({ body: z.string().trim().min(1).max(500) }).safeParse(req.body);
  if (!team) {
    res.status(401).json({ error: '다시 입장해주세요.' });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: '질문 내용을 입력해주세요.' });
    return;
  }
  const [row] = await db
    .insert(questions)
    .values({ sessionId: team.sessionId, teamId: team.teamId, body: parsed.data.body })
    .returning();
  notifySession(team.sessionId);
  res.json({ ok: true, question: { id: row.id, body: row.body, status: row.status } });
});

playRouter.post('/vote', requireTeam, async (req, res) => {
  const team = teamOf(req);
  const parsed = z.object({ submissionId: z.string().min(1) }).safeParse(req.body);
  if (!team) {
    res.status(401).json({ error: '다시 입장해주세요.' });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: '투표 대상을 선택해주세요.' });
    return;
  }
  const [target] = await db
    .select()
    .from(submissions)
    .where(eq(submissions.id, parsed.data.submissionId));
  if (!target) {
    res.status(404).json({ error: '제출물을 찾을 수 없습니다.' });
    return;
  }
  if (target.teamId === team.teamId) {
    res.status(400).json({ error: '우리 조에는 투표할 수 없습니다.' });
    return;
  }
  await db
    .insert(votes)
    .values({ submissionId: target.id, voterTeamId: team.teamId })
    .onConflictDoNothing();
  notifySession(team.sessionId);
  res.json({ ok: true });
});

const uploadDir = path.resolve(env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 12);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }
});

playRouter.post('/upload', requireTeam, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: '파일을 선택해주세요.' });
    return;
  }
  res.json({
    url: `/uploads/${req.file.filename}`,
    name: Buffer.from(req.file.originalname, 'latin1').toString('utf8')
  });
});

