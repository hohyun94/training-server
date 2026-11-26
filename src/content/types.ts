/** 교육 콘텐츠(5단계 템플릿) 타입 — 세션 생성·콘텐츠 교체 API 가 함께 쓴다. */
export type TemplateInputType = 'text' | 'longtext' | 'choice' | 'number' | 'url' | 'file';

export type TemplateMission = {
  title?: string;
  prompt: string;
  inputType?: TemplateInputType;
  options?: string[];
  maxLen?: number;
  allowEdit?: boolean;
  required?: boolean;
};

export type TemplateSlide = {
  type?: 'markdown' | 'image' | 'url';
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
