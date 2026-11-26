import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { get } from '../api';
import Countdown from '../components/Countdown';
import MissionPanel from '../components/ScreenMission';
import { IdlePanel, LecturePanel, StageIntroPanel } from '../components/ScreenPanels';
import { ReviewPanel, ScoreboardPanel } from '../components/ScreenReview';
import { connectRealtime } from '../socket';
import { SCREEN_MODE_LABEL } from '../theme';
import type { ScreenBundle, TimerView } from '../types';

export default function Screen() {
  const { joinCode = '' } = useParams();
  const [bundle, setBundle] = useState<ScreenBundle | null>(null);
  const [error, setError] = useState('');
  const [liveTimer, setLiveTimer] = useState<TimerView | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await get<ScreenBundle>(`/public/screen/${encodeURIComponent(joinCode)}`);
      setBundle(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '화면을 불러오지 못했습니다.');
    }
  }, [joinCode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const rt = connectRealtime({ joinCode });
    const offRefresh = rt.onRefresh(() => void load());
    const offTimer = rt.onTimer((timer) => setLiveTimer(timer));
    return () => {
      offRefresh();
      offTimer();
      rt.disconnect();
    };
  }, [joinCode, load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    document.title = bundle ? `${bundle.session.title} · 진행 화면` : '진행 화면';
  }, [bundle]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-white">
        <p className="text-sm text-rose-300">{error}</p>
        <p className="text-xs text-white/30">입장 코드: {joinCode}</p>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white/40">
        화면 준비 중…
      </div>
    );
  }

  const view: ScreenBundle = liveTimer
    ? { ...bundle, screen: { ...bundle.screen, timer: liveTimer } }
    : bundle;

  const mode = view.screen.mode;
  const pinned = view.announcements.find((item) => item.pinned) ?? view.announcements[0];

  const panel = (() => {
    switch (mode) {
      case 'stage_intro':
        return <StageIntroPanel bundle={view} />;
      case 'mission':
        return <MissionPanel bundle={view} />;
      case 'lecture':
        return <LecturePanel bundle={view} />;
      case 'review':
        return <ReviewPanel bundle={view} />;
      case 'scoreboard':
        return <ScoreboardPanel bundle={view} />;
      default:
        return <IdlePanel bundle={view} />;
    }
  })();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-6 border-b border-white/10 px-8 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="shrink-0 rounded-lg bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
            Live
          </span>
          <h1 className="truncate text-lg font-bold">{view.session.title}</h1>
          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-0.5 text-[11px] text-white/40">
            {SCREEN_MODE_LABEL[mode] ?? mode}
          </span>
        </div>

        <div className="hidden flex-1 items-center justify-center gap-2 lg:flex">
          {view.stages.map((stage) => {
            const active = stage.id === view.screen.activeStageId;
            const done = stage.state === 'closed';
            return (
              <div
                key={stage.id}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-sky-500/20 text-sky-200'
                    : done
                      ? 'bg-white/5 text-white/30 line-through'
                      : 'bg-white/5 text-white/40'
                }`}
              >
                <span>{stage.seq}</span>
                <span className="max-w-[7rem] truncate">{stage.title}</span>
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-5">
          <Countdown timer={view.screen.timer} size="md" className="text-white" />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-white/30">참여 코드</p>
            <p className="font-mono text-lg font-black tracking-[0.2em] text-sky-300">
              {view.session.joinCode}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void document.documentElement.requestFullscreen?.();
            }}
            className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/40 hover:bg-white/5"
          >
            전체화면
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">{panel}</main>

      {pinned && (
        <footer className="flex items-center gap-3 border-t border-white/10 bg-white/[0.03] px-8 py-3">
          <span className="shrink-0 rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-rose-300">
            공지
          </span>
          <p className="truncate text-sm text-white/70">{pinned.body}</p>
        </footer>
      )}
    </div>
  );
}
