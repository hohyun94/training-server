type Palette = {
  solid: string;
  soft: string;
  text: string;
  border: string;
  dot: string;
  gradient: string;
};

const palette: Record<string, Palette> = {
  sky: {
    solid: 'bg-sky-500',
    soft: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    dot: 'bg-sky-500',
    gradient: 'from-sky-500 to-cyan-400'
  },
  violet: {
    solid: 'bg-violet-500',
    soft: 'bg-violet-50',
    text: 'text-violet-700',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    gradient: 'from-violet-500 to-fuchsia-400'
  },
  amber: {
    solid: 'bg-amber-500',
    soft: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    gradient: 'from-amber-500 to-orange-400'
  },
  emerald: {
    solid: 'bg-emerald-500',
    soft: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-400'
  },
  rose: {
    solid: 'bg-rose-500',
    soft: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    gradient: 'from-rose-500 to-pink-400'
  },
  cyan: {
    solid: 'bg-cyan-500',
    soft: 'bg-cyan-50',
    text: 'text-cyan-700',
    border: 'border-cyan-200',
    dot: 'bg-cyan-500',
    gradient: 'from-cyan-500 to-sky-400'
  },
  lime: {
    solid: 'bg-lime-500',
    soft: 'bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-200',
    dot: 'bg-lime-500',
    gradient: 'from-lime-500 to-emerald-400'
  },
  fuchsia: {
    solid: 'bg-fuchsia-500',
    soft: 'bg-fuchsia-50',
    text: 'text-fuchsia-700',
    border: 'border-fuchsia-200',
    dot: 'bg-fuchsia-500',
    gradient: 'from-fuchsia-500 to-purple-400'
  },
  orange: {
    solid: 'bg-orange-500',
    soft: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    gradient: 'from-orange-500 to-amber-400'
  },
  teal: {
    solid: 'bg-teal-500',
    soft: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
    gradient: 'from-teal-500 to-cyan-400'
  }
};

export function teamTheme(color: string | undefined): Palette {
  return (color && palette[color]) || palette.sky;
}

export const STAGE_STATE_LABEL: Record<string, string> = {
  locked: '대기',
  open: '진행중',
  review: '리뷰중',
  closed: '마감'
};

export const STAGE_STATE_STYLE: Record<string, string> = {
  locked: 'bg-slate-100 text-slate-500',
  open: 'bg-emerald-100 text-emerald-700',
  review: 'bg-amber-100 text-amber-800',
  closed: 'bg-slate-200 text-slate-600'
};

export const SCREEN_MODE_LABEL: Record<string, string> = {
  idle: '대기 화면',
  stage_intro: '단계 소개',
  mission: '미션 진행',
  lecture: '강의자료',
  review: '결과 리뷰',
  scoreboard: '집계'
};

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export function maskTeamName(name: string, index: number): string {
  return `조 ${index + 1}`;
}
