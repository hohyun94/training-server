import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { methodologyTemplate } from '../content/default-template.js';
import { db, pool } from './index.js';
import { missions, screenStates, sessions, stages, submissions, teams } from './schema.js';
import { pickColor } from '../lib/codes.js';
import { applyTemplate } from '../lib/template.js';

const JOIN_CODE = 'DEMO01';

async function main(): Promise<void> {
  console.log('[seed] 기존 데모 세션 정리...');
  await db.delete(sessions).where(eq(sessions.joinCode, JOIN_CODE));

  const [session] = await db
    .insert(sessions)
    .values({
      title: '방법론 실습 (데모)',
      joinCode: JOIN_CODE,
      status: 'live'
    })
    .returning();

  await applyTemplate(session.id, methodologyTemplate);

  const teamNames = ['1조 · 정의', '2조 · 분석', '3조 · 대안', '4조 · 실행'];
  const teamRows = await db
    .insert(teams)
    .values(
      teamNames.map((name, index) => ({
        sessionId: session.id,
        name,
        color: pickColor(index),
        members: ''
      }))
    )
    .returning();

  const stageRows = await db
    .select()
    .from(stages)
    .where(eq(stages.sessionId, session.id));
  const firstStage = stageRows.sort((a, b) => a.seq - b.seq)[0];

  await db
    .update(stages)
    .set({ state: 'open' })
    .where(eq(stages.id, firstStage.id));

  const missionRows = await db
    .select()
    .from(missions)
    .where(eq(missions.stageId, firstStage.id));
  const firstMission = missionRows.sort((a, b) => a.seq - b.seq)[0];

  const samples = [
    '고객지원팀이 / 월 300건의 반복 문의를 / 평균 4시간 안에 처리하지 못해 이탈이 발생한다.',
    '현장 운영자가 / 주문 상태를 확인할 방법이 없어 / 매번 본사에 전화로 문의한다.',
    '기획팀이 / 신규 기능 우선순위를 정할 근거가 없어 / 매번 감으로 결정한다.',
    '교육운영팀이 / 수강생 이해도를 확인할 방법이 없어 / 교육 효과를 측정하지 못한다.'
  ];

  if (firstMission) {
    await db.insert(submissions).values(
      teamRows.map((team, index) => ({
        missionId: firstMission.id,
        teamId: team.id,
        content: samples[index] ?? '',
        status: index < 3 ? 'submitted' : 'draft',
        submittedAt: index < 3 ? new Date() : null
      }))
    );
  }

  await db
    .update(screenStates)
    .set({
      mode: 'mission',
      activeStageId: firstStage.id,
      activeMissionId: firstMission?.id ?? null,
      timerRunning: false,
      timerEndsAt: null,
      timerRemainingSec: 600,
      updatedAt: new Date()
    })
    .where(eq(screenStates.sessionId, session.id));

  console.log('[seed] 완료');
  console.log(`  세션 ID   : ${session.id}`);
  console.log(`  참여 코드 : ${JOIN_CODE}`);
  console.log(`  조        : ${teamNames.join(', ')}`);
  console.log('  강사 로그인: .env 의 ADMIN_PASSWORD');
}

main()
  .catch((err) => {
    console.error('[seed] 실패', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
