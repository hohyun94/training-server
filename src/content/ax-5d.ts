import type { SessionTemplate } from './types.js';

/**
 * AXCenter(5D 과제 관리 포털)의 5D 계약을 교육용 실습 미션으로 옮긴 콘텐츠.
 *
 * 원본 기준
 * - `packages/ax-contracts/src/ax.ts` : AX_STAGES, AX_NATURE_META, AX_PAIN_POINT_GROUPS,
 *   AX_BDW_TYPE_META, AI-FIT 축, ZBR 4원칙, HITL 패턴, KPI 3레이어
 * - `apps/ax-center/server/services/progress.ts` : 단계별 필수 산출물 체크리스트
 * - `apps/ax-center/client/src/pages/ax/stage-forms/*` : 단계별 입력 항목·문구
 *
 * 필수 산출물은 AXCenter 의 완료 조건과 동일하게 맞췄다.
 */
export const ax5dTemplate: SessionTemplate = {
  title: 'AX 5D 방법론 실습',
  stages: [
    {
      title: 'Discover · 문제 발견',
      goal: '우리 업무 한 덩어리를 있는 그대로 관찰하고, 어디로 갈지(TO-BE)를 먼저 그린다.',
      timeLimitSec: 900,
      slides: [
        {
          type: 'markdown',
          content:
            '# D1 · Discover — 문제 발견\n\n- **AS-IS**: 지금 벌어지는 일을 **사실대로** 적는다 (해결책 금지)\n- **TO-BE**: 우리가 향할 방향을 먼저 그린다 (Future-Back)\n\n### 필수 산출물\n1. 다루는 업무\n2. Pain Point 1개 이상\n3. Future-Back (향할 방향 · AI가 맡을 일 · 사람이 남길 일)'
        },
        {
          type: 'markdown',
          content:
            '# 작성 기준\n\n- **다루는 업무**: 우리 부서에서 실제로 일어나는 **한 덩어리** (누가 · 무엇을 · 언제)\n- **Pain Point 성격**\n  - 시스템·데이터 / 프로세스·승인 / 인력·시간 / 고객·채널 / 문서·보고\n- **Future-Back 4칸**\n  - 향할 방향 · AI가 맡을 일 · 사람이 남길 일 · 새로 생기는 일'
        }
      ],
      missions: [
        {
          title: '과제 유형',
          prompt:
            '이 과제를 어디서 분해할지 먼저 정합니다.\n프로세스 기반이면 ProcessCenter의 정형 프로세스(L4)에 매핑되고, Ad-hoc 업무면 가상 업무 단위로 L5~L7을 분해합니다.',
          inputType: 'choice',
          options: [
            '프로세스 기반 — 정형 프로세스에 매핑된다',
            'Ad-hoc 업무 — 프로세스 노드로 풀 수 없다'
          ]
        },
        {
          title: '① 다루는 업무 — 전체 흐름',
          prompt:
            '우리 부서에서 실제로 일어나는 업무 한 덩어리를 적습니다.\n누가 · 무엇을 · 언제 하는지 사실대로 쓰고, 해결책은 아직 쓰지 않습니다.',
          inputType: 'longtext',
          maxLen: 800
        },
        {
          title: '② 가장 큰 어려움 (성격)',
          prompt:
            '이 업무를 하며 겪는 어려움 중 가장 큰 것의 성격을 고릅니다. (여러 개라면 가장 큰 하나)',
          inputType: 'choice',
          options: [
            '시스템·데이터 — 시스템을 오가며 데이터를 옮겨 적는다',
            '프로세스·승인 — 같은 판단을 반복하고 승인 대기로 멈춘다',
            '인력·시간 — 단순 확인·재작업이 하루를 잡아먹는다',
            '고객·채널 — 문의가 흩어져 확인이 늦거나 누락된다',
            '문서·보고 — 보고서를 매번 처음부터 다시 만든다'
          ]
        },
        {
          title: '② 겪는 어려움 — 상세',
          prompt:
            '아래 체크리스트에서 해당하는 항목을 골라 옮겨 적고(1개 이상), 실제로 겪은 사례를 한 줄 덧붙입니다.\n\n[시스템·데이터]\n- 시스템 여러 개를 오가며 데이터를 옮겨 적는다\n- 같은 고객·상품 정보가 시스템마다 달라 매번 확인해야 한다\n- 자료가 엑셀·메일함에 흩어져 있어 최신본을 찾기 어렵다\n\n[프로세스·승인]\n- 같은 판단을 사람이 반복해서 내리고 있다\n- 담당자 부재·승인 대기로 처리가 멈추는 일이 잦다\n- 처리 기준이 사람마다 달라 결과가 들쭉날쭉하다\n- 간단한 건도 정해진 결재 단계를 모두 거쳐야 해서 처리가 늦다\n\n[인력·시간]\n- 단순 확인·조회 업무가 하루 시간의 큰 부분을 차지한다\n- 오류를 찾아 되돌리는 재작업이 반복된다\n- 숙련자에게 일이 몰려 그 사람이 자리를 비우면 진행이 멈춘다\n- 반복 업무에 밀려 개선이나 분석할 시간을 확보하지 못한다\n\n[고객·채널]\n- 문의가 전화·메일·채팅으로 흩어져 확인이 늦거나 누락된다\n- 고객이 같은 내용을 여러 번 말해야 하는 일이 생긴다\n- 담당자마다 안내하는 내용이 달라 고객이 혼란스러워한다\n\n[문서·보고]\n- 보고·요약 자료를 매번 처음부터 다시 만든다\n- 여러 곳의 수치를 모아 보고서를 만드는 데 반나절 이상 걸린다',
          inputType: 'longtext',
          maxLen: 2000
        },
        {
          title: '③ 업무 흐름 (Landscape)',
          prompt:
            '업무 흐름을 단계 순서대로 적습니다. 적은 순서가 그대로 흐름 순서가 됩니다.\n예) 접수 → 확인 → 승인 → 처리 → 통보',
          inputType: 'longtext',
          maxLen: 600,
          required: false
        },
        {
          title: '④ TO-BE — Future-Back 4칸',
          prompt:
            'TO-BE — 우리가 향할 방향을 먼저 그립니다. 네 칸을 채워주세요.\n\n향할 방향(목표 상태):\n\nAI가 맡을 일:\n\n사람이 남길 일:\n\n새로 생기는 일:',
          inputType: 'longtext',
          maxLen: 1200
        }
      ]
    },
    {
      title: 'Diagnose · 병목 진단',
      goal: 'BDW로 병목·지연·낭비를 찾고, AI-FIT 점수로 "AI가 잘할 일"인지 판정한다.',
      timeLimitSec: 1200,
      slides: [
        {
          type: 'markdown',
          content:
            '# D2 · Diagnose — 병목 진단\n\n### BDW 3유형\n- 🔴 **병목**: 일이 막히거나 처리량 부족으로 대기가 생긴다\n- 🟡 **지연**: 작업 전후·승인·확인을 기다린다\n- 🟢 **낭비**: 정말 필요한가? 중복되거나 더 단순화할 수 있다'
        },
        {
          type: 'markdown',
          content:
            '# AI-FIT · STATIK\n\n- **AI-FIT** = 적용 가능성 × 비효율성 (각 1~5)\n  - 둘 다 3.5 이상 → 1차 적용 후보\n- **STATIK**: L5 업무 → L6 단계 → L7 액션, 각 L7의 수행주체(AI/사람)\n- 근거(인터뷰·문서·로그) 없는 점수는 만들지 않는다\n\n### 필수 산출물\nBDW 1개 이상 · AI-FIT 1개 이상 · STATIK L7 분해'
        }
      ],
      missions: [
        {
          title: 'BDW 유형',
          prompt: '찾은 문제가 어느 유형인지 고릅니다. 질문에 "그렇다"고 답할수록 그 유형입니다.',
          inputType: 'choice',
          options: [
            '🔴 병목 — 일이 막히거나 처리량 부족으로 대기가 생긴다',
            '🟡 지연 — 작업 전후·승인·확인을 기다린다',
            '🟢 낭비 — 정말 필요한가? 중복되거나 더 단순화할 수 있다'
          ]
        },
        {
          title: 'BDW 카드',
          prompt:
            'BDW 카드를 완성합니다.\n\nBDW 이름:\n어디서 일어나는가(L6 단계):\n근본 원인:\n정량 근거(건수·시간·인원):\n개선 아이디어(낭비형은 필수):',
          inputType: 'longtext',
          maxLen: 1500
        },
        {
          title: '업무 분해 — L5 · L6 · L7',
          prompt:
            '업무를 L5 → L6 → L7로 분해하고, 각 L7의 수행주체를 적습니다.\n\nL5 업무:\n- L6 단계:\n  - L7 액션 / 수행주체(AI 또는 사람)\n\n예)\n주문 처리\n- 접수\n  - 주문서 검증 / AI\n  - 예외 고객 확인 / 사람',
          inputType: 'longtext',
          maxLen: 2000
        },
        {
          title: 'AI-FIT ① 적용 가능성',
          prompt: '이 일을 AI가 얼마나 잘할 수 있는가? (1 = 사람이 반드시 해야 함 ~ 5 = AI가 더 잘함)',
          inputType: 'choice',
          options: [
            '1 · 사람이 반드시 해야 한다',
            '2 · 대부분 사람이 적합하다',
            '3 · 조건부로 가능하다',
            '4 · 대부분 AI가 적합하다',
            '5 · AI가 더 잘한다'
          ]
        },
        {
          title: 'AI-FIT ② 비효율성',
          prompt: '지금 이 일이 얼마나 비효율적인가? (1 = 문제 없음 ~ 5 = 매우 비효율)',
          inputType: 'choice',
          options: ['1 · 문제 없음', '2 · 경미', '3 · 보통', '4 · 큼', '5 · 매우 큼']
        }
      ]
    },
    {
      title: 'Design · AI 전환 설계',
      goal: '문제를 4필드로 정의하고, ZBR 4원칙으로 일을 다시 설계한 뒤 에이전트·KPI까지 확정한다.',
      timeLimitSec: 1500,
      slides: [
        {
          type: 'markdown',
          content:
            '# D3 · Design — AI 전환 설계\n\n### 문제 정의 4필드\n**WHAT** 무엇이 문제인가 · **WHY** 왜 그런가 · **IMPACT** 무엇이 달라지는가 · **GOAL** 얼마나\n\n### ZBR 4원칙\n1. **없앤다** (Eliminate) — 없애거나 합칠 단계\n2. **맡긴다** (Delegate) — AI가 맡을 일\n3. **기준을 갖는다** (Govern) — 사람이 가질 판단 기준·책임\n4. **검증한다** (Verify) — 결과를 어떻게 확인할 것인가'
        },
        {
          type: 'markdown',
          content:
            '# 에이전트 명세 · KPI\n\n- 에이전트: 트리거 · 입력/출력 · 도구 · **HiTL** · 가드레일 · 실패 인계 · **Phase(1~3)**\n- HiTL: AI 초안→사람 확인 / AI 추천→사람 선택 / AI 실행→사람 모니터링 / 예외는 사람 개입\n- KPI 3레이어: **AI 성과** · **사람 역할** · **사업 임팩트** (기준선 → 목표)\n\n*모든 AI L7은 정확히 하나의 에이전트에 포함되어야 한다 (고아 AI 작업 금지).*'
        }
      ],
      missions: [
        {
          title: '문제 정의 ① WHAT · WHY · IMPACT',
          prompt:
            '문제 정의 3필드를 한 문장씩 적습니다.\n\nWHAT — 무엇이 문제인가:\n\nWHY — 왜 그런가(근본 원인):\n\nIMPACT — 무엇이 달라지는가(영향):',
          inputType: 'longtext',
          maxLen: 1200
        },
        {
          title: '문제 정의 ② GOAL',
          prompt:
            'GOAL — 무엇을 얼마나 달성할지 숫자로 적습니다.\n예) 주문 확인 3분 → 30초, 처리 시간 60% 감소',
          inputType: 'text',
          maxLen: 300
        },
        {
          title: 'ZBR 4원칙',
          prompt:
            'ZBR 4원칙으로 일을 다시 설계합니다.\n\n① 없앤다(Eliminate) — 없애거나 합칠 단계:\n\n② 맡긴다(Delegate) — AI가 맡을 일:\n\n③ 기준을 갖는다(Govern) — 사람이 가질 판단 기준·책임:\n\n④ 검증한다(Verify) — 결과를 어떻게 확인할 것인가:',
          inputType: 'longtext',
          maxLen: 1500
        },
        {
          title: '에이전트 명세',
          prompt:
            'AI가 맡기로 한 일을 에이전트 단위로 묶고 명세를 적습니다.\n\n에이전트 이름:\n트리거(언제 시작되는가):\n입력 → 출력:\n사용할 도구:\nHiTL(사람이 개입하는 지점):\n가드레일(하지 말아야 할 일):\n실패 시 인계:\n적용 순서(Phase 1~3):',
          inputType: 'longtext',
          maxLen: 2000
        },
        {
          title: 'HiTL 패턴',
          prompt: '이 에이전트는 어떤 방식으로 사람과 협업하는가? 하나를 고릅니다.',
          inputType: 'choice',
          options: [
            'AI 초안 → 사람 확인 (리뷰 답글·보고서)',
            'AI 추천 → 사람 선택 (발주량 추천)',
            'AI 실행 → 사람 모니터링 (이상 탐지)',
            '예외만 사람 개입 (규정 밖 케이스)'
          ]
        },
        {
          title: 'KPI 3레이어',
          prompt:
            'KPI를 3레이어에서 각 1개 이상 적습니다. 각 항목에 이름 / 정의 / 단위 / 기준선 / 목표를 함께 적습니다.\n\nAI 성과 — 정확도 · 자동 처리율 등:\n\n사람 역할 — 검토 시간 · 개입 비율 등:\n\n사업 임팩트 — 처리 시간 · 비용 · 만족도 등:',
          inputType: 'longtext',
          maxLen: 1500
        }
      ]
    },
    {
      title: 'Deliver · 파일럿 실행',
      goal: '파일럿 범위와 성공 기준을 정하고, KPI를 Before/After로 측정한다.',
      timeLimitSec: 1200,
      slides: [
        {
          type: 'markdown',
          content:
            '# D4 · Deliver — 파일럿 실행\n\n- **파일럿 범위**: 어디까지 · 누구와 · 언제부터\n- **성공 기준**: 숫자로 판정 가능하게\n- **KPI 측정**: Before / After (Design의 KPI와 연결)\n- **개발 준비 패키지**: 지시문 · 출력 계약(형식·스키마·예시) · 평가 케이스(정상·경계·실패)\n\n### 필수 산출물\n파일럿 범위·성공 기준 · KPI 측정 1건 이상'
        }
      ],
      missions: [
        {
          title: '파일럿 범위 · 성공 기준',
          prompt:
            '파일럿 범위와 성공 기준을 정합니다.\n\n범위(어디까지):\n대상(누구와):\n성공 기준(숫자로):\n중단 기준(이러면 멈춘다):',
          inputType: 'longtext',
          maxLen: 1200
        },
        {
          title: '파일럿 기간',
          prompt: '시작일 ~ 종료일 형식으로 적습니다. 예) 2026-01-05 ~ 2026-02-06',
          inputType: 'text',
          maxLen: 60
        },
        {
          title: 'KPI 측정 (Before / After)',
          prompt:
            '파일럿 결과를 Before / After로 측정합니다.\n\nKPI 이름:\nBefore(기준선):\nAfter(결과):\n측정 방법·출처:\n해석(왜 이렇게 나왔는가):',
          inputType: 'longtext',
          maxLen: 1200
        },
        {
          title: '개발 준비 패키지',
          prompt:
            '개발 준비 패키지를 첨부합니다 — 지시문(prompt) · 출력 계약(형식·스키마·예시) · 평가 케이스(정상·경계·실패).\n파일이 없으면 아래 답안 칸에 요약을 적어도 됩니다.',
          inputType: 'file',
          required: false
        }
      ]
    },
    {
      title: 'Deepen · 회고와 확산',
      goal: 'AAR로 되돌아보고, 다음 과제에 재사용할 교훈을 남긴다.',
      timeLimitSec: 900,
      slides: [
        {
          type: 'markdown',
          content:
            '# D5 · Deepen — 회고와 확산\n\n### AAR\n- Q1 무엇을 달성하려 했는가\n- Q2 실제로 무슨 일이 일어났는가\n- Q3 왜 그렇게 되었는가\n\n### Keep · Stop · Start\n### Lessons\n- 맥락(Context) · 구체적 내용(Specific) · 검증 근거(Validated) · 적용 조건(Applicable)'
        }
      ],
      missions: [
        {
          title: 'AAR — 되돌아보기',
          prompt:
            'AAR(After Action Review) 세 질문에 답합니다.\n\nQ1 무엇을 달성하려 했는가:\n\nQ2 실제로 무슨 일이 일어났는가:\n\nQ3 왜 그렇게 되었는가:',
          inputType: 'longtext',
          maxLen: 1200
        },
        {
          title: 'Keep · Stop · Start',
          prompt: '다음 과제에서 이어갈 것과 바꿀 것을 정합니다.\n\nKeep — 계속할 것:\nStop — 멈출 것:\nStart — 새로 시작할 것:',
          inputType: 'longtext',
          maxLen: 800
        },
        {
          title: 'Lessons Learned',
          prompt:
            '다른 과제에 다시 쓸 수 있게 교훈을 남깁니다.\n\n맥락(Context):\n구체적 내용(Specific):\n검증 근거(Validated):\n적용 조건(Applicable):',
          inputType: 'longtext',
          maxLen: 1200
        }
      ]
    }
  ]
};

