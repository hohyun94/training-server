import Countdown from './Countdown';
import Markdown from './Markdown';
import { teamTheme } from '../theme';
import type { ScreenBundle } from '../types';

export function IdlePanel({ bundle }: { bundle: ScreenBundle }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-12 px-10 py-12">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.55em] text-sky-300/70">
          Join now
        </p>
        <h2 className="mt-4 text-5xl font-black">모바일로 참여하세요</h2>
        <p className="mt-3 text-white/50">
          입장 코드{' '}
          <span className="ml-2 rounded-xl bg-white/10 px-3 py-1 font-mono text-3xl font-black tracking-[0.3em] text-sky-300">
            {bundle.session.joinCode}
          </span>
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-10">
        <div className="rounded-3xl bg-white p-5 shadow-[0_25px_80px_-20px_rgba(56,189,248,0.55)]">
          <img
            src={`/api/public/qr?data=${encodeURIComponent(bundle.joinUrl)}`}
            alt="참여 QR 코드"
            className="h-56 w-56"
          />
        </div>

        <div className="grid max-w-xl grid-cols-2 gap-3">
          {bundle.teams.map((team) => {
            const theme = teamTheme(team.color);
            return (
              <div
                key={team.id}
                className="flex min-w-[10rem] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <span className={`h-3 w-3 rounded-full ${theme.dot}`} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{team.name}</p>
                  <p className="truncate text-xs text-white/40">
                    {team.members || '참여 대기'}
                  </p>
                </div>
              </div>
            );
          })}
          {!bundle.teams.length && (
            <p className="text-sm text-white/40">아직 입장한 조가 없습니다.</p>
          )}
        </div>
      </div>

      <p className="text-xs text-white/25">{bundle.joinUrl}</p>
    </div>
  );
}

export function StageIntroPanel({ bundle }: { bundle: ScreenBundle }) {
  const stage = bundle.stage;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-10 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.5em] text-sky-300/70">Stage</p>
      <p className="text-[10rem] font-black leading-none text-white/10">
        {stage ? String(stage.seq).padStart(2, '0') : '--'}
      </p>
      <h2 className="-mt-20 text-5xl font-black leading-tight">
        {stage?.title ?? '준비 중'}
      </h2>
      {stage?.goal && <p className="max-w-3xl text-xl text-white/60">{stage.goal}</p>}

      <div className="mt-4 flex items-center gap-4">
        {stage && (
          <span className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-white/70">
            미션 {stage.missions.length}개 · 제한 {Math.round(stage.timeLimitSec / 60)}분
          </span>
        )}
        <Countdown timer={bundle.screen.timer} size="xl" className="text-sky-300" />
      </div>
    </div>
  );
}

export function LecturePanel({ bundle }: { bundle: ScreenBundle }) {
  const slide = bundle.slide;

  if (!slide) {
    return (
      <div className="flex flex-1 items-center justify-center text-white/40">
        이 단계에 등록된 강의자료가 없습니다.
      </div>
    );
  }

  if (slide.type === 'image') {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <img src={slide.content} alt="강의자료" className="max-h-full max-w-full rounded-2xl" />
      </div>
    );
  }

  if (slide.type === 'url') {
    return (
      <div className="flex-1 p-6">
        <iframe
          src={slide.content}
          title="강의자료"
          className="h-full w-full rounded-2xl border border-white/10 bg-white"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-16 py-10">
      <div className="w-full max-w-5xl text-white">
        <Markdown text={slide.content} className="text-3xl leading-relaxed [&_h1]:text-6xl" />
        <div className="mt-10 flex items-center justify-between text-sm text-white/30">
          <span>{bundle.stage?.title}</span>
          <span>
            {bundle.screen.slideIndex + 1} / {bundle.stage?.slides.length ?? 1}
          </span>
        </div>
      </div>
    </div>
  );
}
