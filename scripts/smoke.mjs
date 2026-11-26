/**
 * 로컬/스테이징 스모크 테스트.
 *   node scripts/smoke.mjs
 * 서버가 떠 있어야 하며(BASE_URL), 강사 비밀번호는 ADMIN_PASSWORD 를 사용합니다.
 */
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:8080';
const PASSWORD = process.env.ADMIN_PASSWORD ?? 'letmein';

let failures = 0;

function check(label, condition, extra = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label} ${extra}`);
  }
}

function makeJar() {
  let cookie = '';
  return {
    get header() {
      return cookie ? { Cookie: cookie } : {};
    },
    absorb(res) {
      const list = res.headers.getSetCookie?.() ?? [];
      for (const raw of list) {
        const pair = raw.split(';')[0];
        const [name] = pair.split('=');
        const rest = cookie
          .split('; ')
          .filter((item) => item && !item.startsWith(`${name}=`))
          .join('; ');
        cookie = rest ? `${rest}; ${pair}` : pair;
      }
    }
  };
}

async function call(jar, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...jar.header
    },
    body: body ? JSON.stringify(body) : undefined
  });
  jar.absorb(res);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

const admin = makeJar();
const team = makeJar();

console.log(`\n▶ smoke test against ${BASE}`);

const health = await call(admin, '/public/health');
check('health', health.res.ok && health.data?.ok === true);

const login = await call(admin, '/auth/login', { method: 'POST', body: { password: PASSWORD } });
check('강사 로그인', login.res.ok, login.text);

const created = await call(admin, '/admin/sessions', {
  method: 'POST',
  body: { title: '스모크 테스트 교육', teamNames: ['A조', 'B조'] }
});
check('회차 생성', created.res.status === 201, created.text);
const sessionId = created.data?.session?.id;
const joinCode = created.data?.session?.joinCode;
console.log(`    session=${sessionId} code=${joinCode}`);

// 콘텐츠 통째로 교체 (docs/content.example.json 형식)
const contentRes = await call(admin, `/admin/sessions/${sessionId}/content`, {
  method: 'POST',
  body: {
    title: '스모크 테스트 교육',
    stages: [
      {
        title: '1단계 · 테스트',
        goal: '문제 정의',
        timeLimitSec: 120,
        missions: [
          { title: '미션', prompt: '한 문장으로 적어주세요.', inputType: 'longtext' }
        ],
        slides: [{ type: 'markdown', content: '# 1단계\n\n- 첫째\n- 둘째' }]
      },
      { title: '2단계 · 테스트', missions: [] },
      { title: '3단계 · 테스트', missions: [] },
      { title: '4단계 · 테스트', missions: [] },
      { title: '5단계 · 테스트', missions: [] }
    ]
  }
});
check('콘텐츠 교체', contentRes.res.ok, contentRes.text);

const bundle = await call(admin, `/admin/sessions/${sessionId}`);
check('관리 번들 조회', bundle.res.ok && bundle.data?.stages?.length === 5);
const stage = bundle.data.stages[0];
const mission =
  stage.missions.find((item) => item.inputType === 'longtext') ?? stage.missions[0];

const opened = await call(admin, `/admin/sessions/${sessionId}/stages/${stage.id}`, {
  method: 'PATCH',
  body: { state: 'open' }
});
check('1단계 열기', opened.res.ok && opened.data?.stage?.state === 'open');

const joined = await call(team, '/public/join', {
  method: 'POST',
  body: { joinCode, teamName: 'A조' }
});
check('교육생 입장', joined.res.ok, joined.text);

const content = '고객지원팀이 / 반복 문의 300건을 / 4시간 안에 처리하지 못한다.';
const submitted = await call(team, '/play/submission', {
  method: 'PUT',
  body: { missionId: mission.id, content, submit: true }
});
check('답안 제출', submitted.res.ok && submitted.data?.submission?.status === 'submitted');

const play = await call(team, '/play/state');
const myMission = play.data?.currentStage?.missions?.find((item) => item.id === mission.id);
check('교육생 화면 반영', myMission?.submission?.content === content);

const screen = await call(admin, `/public/screen/${joinCode}`);
check(
  '프로젝터 제출물 노출',
  screen.res.ok && screen.data?.submissions?.some((item) => item.content === content)
);

const timer = await call(admin, `/admin/sessions/${sessionId}/timer`, {
  method: 'POST',
  body: { action: 'start', seconds: 30 }
});
check('타이머 시작', timer.res.ok);
const afterTimer = await call(admin, `/admin/sessions/${sessionId}`);
check('타이머 카운트다운', afterTimer.data?.screen?.timer?.running === true);

const review = await call(admin, `/admin/sessions/${sessionId}/screen`, {
  method: 'PATCH',
  body: { mode: 'review', activeMissionId: mission.id }
});
const afterReview = await call(admin, `/admin/sessions/${sessionId}`);
check('리뷰 모드 전환', review.res.ok && !!afterReview.data?.screen?.reviewSubmissionId);

const submissionId = afterReview.data.screen.reviewSubmissionId;
const feedback = await call(
  admin,
  `/admin/sessions/${sessionId}/submissions/${submissionId}/feedback`,
  { method: 'POST', body: { body: '문제 정의가 명확합니다.', score: 90, isStar: true } }
);
check('피드백 저장', feedback.res.status === 201, feedback.text);

const afterFeedback = await call(team, '/play/state');
check(
  '교육생 피드백 확인',
  afterFeedback.data?.currentStage?.missions
    ?.find((item) => item.id === mission.id)
    ?.submission?.feedbacks?.some((item) => item.score === 90) === true
);

const announce = await call(admin, `/admin/sessions/${sessionId}/announcements`, {
  method: 'POST',
  body: { body: '3분 뒤 2단계로 이동합니다.', pinned: true }
});
check('공지 등록', announce.res.status === 201);
const afterAnnounce = await call(team, '/play/state');
check(
  '교육생 공지 수신',
  afterAnnounce.data?.announcements?.[0]?.body === '3분 뒤 2단계로 이동합니다.'
);

const question = await call(team, '/play/question', {
  method: 'POST',
  body: { body: '이해관계자는 몇 명까지 적나요?' }
});
check('질문 등록', question.res.ok);
const questionId = question.data?.question?.id;
const answered = await call(admin, `/admin/sessions/${sessionId}/questions/${questionId}/answer`, {
  method: 'POST',
  body: { answer: '3명 이상이면 충분합니다.' }
});
check('질문 답변', answered.res.ok);
const afterAnswer = await call(team, '/play/state');
check(
  '교육생 답변 확인',
  afterAnswer.data?.myQuestions?.some((item) => item.status === 'answered') === true
);

const lecture = await call(admin, `/admin/sessions/${sessionId}/screen`, {
  method: 'PATCH',
  body: { mode: 'lecture', activeStageId: stage.id, slideIndex: 0 }
});
const afterLecture = await call(admin, `/public/screen/${joinCode}`);
check(
  '강의자료 송출',
  lecture.res.ok && !!afterLecture.data?.slide?.id && afterLecture.data?.screen?.mode === 'lecture'
);

const scoreboard = await call(admin, `/admin/sessions/${sessionId}/screen`, {
  method: 'PATCH',
  body: { mode: 'scoreboard' }
});
check('집계 화면', scoreboard.res.ok);

const exportRes = await fetch(`${BASE}/api/admin/sessions/${sessionId}/export.xlsx`, {
  headers: admin.header
});
const xlsx = await exportRes.arrayBuffer();
check(
  '엑셀 다운로드',
  exportRes.ok && xlsx.byteLength > 2000,
  `status=${exportRes.status} bytes=${xlsx.byteLength}`
);

const removed = await call(admin, `/admin/sessions/${sessionId}`, { method: 'DELETE' });
check('테스트 회차 삭제', removed.res.ok);

console.log(failures === 0 ? '\n✅ 모든 스모크 테스트 통과\n' : `\n❌ ${failures}건 실패\n`);
process.exit(failures === 0 ? 0 : 1);

