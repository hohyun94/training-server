export type TemplateMission = {
  title?: string;
  prompt: string;
  inputType?: string;
  options?: string[];
  maxLen?: number;
  allowEdit?: boolean;
  required?: boolean;
};

export type TemplateSlide = {
  type?: string;
  content: string;
  notes?: string;
};

export type TemplateStage = {
  title: string;
  goal?: string;
  timeLimitSec?: number;
  missions?: TemplateMission[];
  slides?: TemplateSlide[];
};

export type SessionTemplate = {
  title: string;
  stages: TemplateStage[];
};

/**
 * 기본 5단계 뼈대. 실제 교육 내용은 강사 콘솔에서 교체하거나
 * POST /api/admin/sessions/:id/content 로 통째로 갈아끼울 수 있다.
 */
export const methodologyTemplate: SessionTemplate = {
  title: '방법론 실습',
  stages: [
    {
      title: '1단계 · 문제 정의',
      goal: '우리가 풀 문제를 한 문장으로 정의한다.',
      timeLimitSec: 600,
      slides: [
        {
          type: 'markdown',
          content:
            '# 1단계 · 문제 정의\n\n- 문제를 **한 문장**으로 적는다\n- 누가(Who) · 무엇을(What) · 왜(Why)를 포함\n- 해결책은 아직 쓰지 않는다'
        }
      ],
      missions: [
        {
          title: '문제 한 문장',
          prompt: '우리 조가 다룰 문제를 "누가 / 무엇을 / 왜"가 드러나게 한 문장으로 적어주세요.',
          inputType: 'longtext',
          maxLen: 300
        },
        {
          title: '이해관계자',
          prompt: '이 문제에 영향을 받는 이해관계자를 3명 이상 적어주세요.',
          inputType: 'longtext',
          maxLen: 500
        }
      ]
    },
    {
      title: '2단계 · 현황 분석',
      goal: 'As-Is 상태를 데이터와 사실로 정리한다.',
      timeLimitSec: 900,
      slides: [
        {
          type: 'markdown',
          content:
            '# 2단계 · 현황 분석\n\n- 추측과 사실을 구분한다\n- 숫자로 말할 수 있는 것은 숫자로\n- 병목 지점을 표시한다'
        }
      ],
      missions: [
        {
          title: 'As-Is 요약',
          prompt: '현재 상태를 사실 중심으로 5줄 이내로 정리해주세요.',
          inputType: 'longtext',
          maxLen: 800
        },
        {
          title: '핵심 병목',
          prompt: '가장 큰 병목 지점 하나를 선택하고 이유를 적어주세요.',
          inputType: 'longtext',
          maxLen: 500
        }
      ]
    },
    {
      title: '3단계 · 대안 도출',
      goal: '가능한 해결 대안을 2개 이상 만들고 비교한다.',
      timeLimitSec: 900,
      slides: [
        {
          type: 'markdown',
          content:
            '# 3단계 · 대안 도출\n\n- 최소 2개 대안\n- 장점 / 단점 / 리스크\n- 선택 기준을 먼저 합의'
        }
      ],
      missions: [
        {
          title: '대안 비교',
          prompt: '대안 2개를 장점·단점·리스크로 비교해주세요.',
          inputType: 'longtext',
          maxLen: 1200
        },
        {
          title: '선택',
          prompt: '우리 조가 선택한 대안은?',
          inputType: 'choice',
          options: ['대안 A', '대안 B', '둘의 조합']
        }
      ]
    },
    {
      title: '4단계 · 실행 계획',
      goal: '누가 언제 무엇을 할지 구체화한다.',
      timeLimitSec: 900,
      slides: [
        {
          type: 'markdown',
          content: '# 4단계 · 실행 계획\n\n- 담당 / 기한 / 산출물\n- 첫 2주에 할 일부터'
        }
      ],
      missions: [
        {
          title: '액션 아이템',
          prompt: '담당자와 기한이 포함된 액션 아이템을 3개 이상 적어주세요.',
          inputType: 'longtext',
          maxLen: 1200
        },
        {
          title: '산출물 링크',
          prompt: '도구로 작성한 결과물 링크(또는 파일)를 첨부해주세요.',
          inputType: 'file',
          required: false
        }
      ]
    },
    {
      title: '5단계 · 검증과 회고',
      goal: '결과를 검증하고 배운 점을 남긴다.',
      timeLimitSec: 600,
      slides: [
        {
          type: 'markdown',
          content: '# 5단계 · 검증과 회고\n\n- 성공 기준 대비 결과\n- Keep / Problem / Try'
        }
      ],
      missions: [
        {
          title: '회고',
          prompt: 'Keep / Problem / Try 형식으로 회고를 적어주세요.',
          inputType: 'longtext',
          maxLen: 1200
        }
      ]
    }
  ]
};
