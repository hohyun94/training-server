import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { ax5dTemplate } from '../content/ax-5d.js';
import { pickColor } from '../lib/codes.js';
import { applyTemplate } from '../lib/template.js';
import { db, pool } from './index.js';
import { missions, screenStates, sessions, stages, submissions, teams } from './schema.js';

const JOIN_CODE = 'DEMO01';

async function main(): Promise<void> {
  console.log('[seed] 기존 데모 세션 정리...');
  await db.delete(sessions).where(eq(sessions.joinCode, JOIN_CODE));

  const [session] = await db
    .insert(sessions)
    .values({
      title: 'AX 5D 방법론 실습 (데모)',
      joinCode: JOIN_CODE,
      status: 'live'
    })
    .returning();

  await applyTemplate(session.id, ax5dTemplate);

  const teamNames = ['1조 · 구매', '2조 · 영업지원', '3조 · 인사', '4조 · 재무'];
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

  const stageRows = await db.select().from(stages).where(eq(stages.sessionId, session.id));
  const firstStage = stageRows.sort((a, b) => a.seq - b.seq)[0];

  await db.update(stages).set({ state: 'open' }).where(eq(stages.id, firstStage.id));

  const stageMissions = await db
    .select()
    .from(missions)
    .where(eq(missions.stageId, firstStage.id));
  const sorted = stageMissions.sort((a, b) => a.seq - b.seq);
  const missionType = sorted[0];
  const missionWork = sorted[1];

  /** Discover 1~2번 미션 데모 답안 (3조까지 제출, 4조는 작성중) */
  const types = [
    '프로세스 기반 — 정형 프로세스에 매핑된다',
    'Ad-hoc 업무 — 프로세스 노드로 풀 수 없다',
    '프로세스 기반 — 정형 프로세스에 매핑된다'
  ];
  const works = [
    '구매팀이 매일 아침 200건의 구매 요청을 접수해 3개 시스템에서 재고·단가·거래처 정보를 확인하고, 팀장 승인을 받아 발주 등록까지 처리한다. 건당 평균 8분, 하루 2시간은 단순 확인에 쓰인다.',
    '영업지원팀이 신규 고객 계약서를 받으면 특약 조항 검토 → 내부 승인 → 전자서명 요청 → ERP 등록을 손으로 진행한다. 건수는 적지만 한 건당 3일 이상 걸린다.',
    '인사팀이 월 1회 전 직원 근태를 취합해 급여 이체 파일을 만들고, 휴직·복직·수당 예외를 개별 확인한다. 마감 주간에는 담당자 한 명에게 일이 몰린다.'
  ];

  if (missionType) {
    await db.insert(submissions).values(
      teamRows.slice(0, 3).map((team, index) => ({
        missionId: missionType.id,
        teamId: team.id,
        content: types[index] ?? '',
        status: 'submitted',
        submittedAt: new Date()
      }))
    );
  }

  if (missionWork) {
    await db.insert(submissions).values(
      teamRows.slice(0, 3).map((team, index) => ({
        missionId: missionWork.id,
        teamId: team.id,
        content: works[index] ?? '',
        status: 'submitted',
        submittedAt: new Date()
      }))
    );
    await db.insert(submissions).values({
      missionId: missionWork.id,
      teamId: teamRows[3].id,
      content: '재무팀이 매월 결산 전 계정별 증빙을 모아 검토하고, 차이 나는 항목을 각 부서에 확인해 조정한다.',
      status: 'draft',
      updatedAt: new Date()
    });
  }

  await db
    .update(screenStates)
    .set({
      mode: 'mission',
      activeStageId: firstStage.id,
      activeMissionId: missionWork?.id ?? missionType?.id ?? null,
      timerRunning: false,
      timerEndsAt: null,
      timerRemainingSec: firstStage.timeLimitSec,
      updatedAt: new Date()
    })
    .where(eq(screenStates.sessionId, session.id));

  console.log('[seed] 완료');
  console.log(`  세션 ID   : ${session.id}`);
  console.log(`  참여 코드 : ${JOIN_CODE}`);
  console.log(`  단계      : ${ax5dTemplate.stages.map((stage) => stage.title).join(' → ')}`);
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
