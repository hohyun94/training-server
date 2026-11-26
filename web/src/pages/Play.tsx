import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get, post, put, uploadFile } from '../api';
import Countdown from '../components/Countdown';
import MissionCard from '../components/MissionCard';
import { connectRealtime } from '../socket';
import { STAGE_STATE_LABEL, STAGE_STATE_STYLE, teamTheme } from '../theme';
import type { PlayBundle, PlayMission, TimerView } from '../types';

export default function Play() {
  const navigate = useNavigate();

  const [bundle, setBundle] = useState<PlayBundle | null>(null);
  const [error, setError] = useState('');
  const [liveTimer, setLiveTimer] = useState<TimerView | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await get<PlayBundle>('/play/state');
      setBundle(data);
      setError('');
      setDrafts((prev) => {
        const next = { ...prev };
        data.stages.forEach((stage) => {
          stage.missions.forEach((mission) => {
            if (next[mission.id] === undefined) {
              next[mission.id] = mission.submission?.content ?? '';
            }
          });
        });
        return next;
      });
      setActiveStageId((current) => current ?? data.currentStage?.id ?? data.stages[0]?.id ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '상태를 불러오지 못했습니다.';
      setError(message);
      if (message.includes('만료') || message.includes('입장')) {
        window.setTimeout(() => navigate('/join'), 1400);
      }
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const rt = connectRealtime({});
    const offRefresh = rt.onRefresh(() => void load());
    const offTimer = rt.onTimer((timer) => setLiveTimer(timer));
    return () => {
      offRefresh();
      offTimer();
      rt.disconnect();
    };
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const save = async (mission: PlayMission, submit: boolean) => {
    setBusy(mission.id);
    try {
      await put('/play/submission', {
        missionId: mission.id,
        content: drafts[mission.id] ?? '',
        submit
      });
      flash(submit ? '제출 완료! 강사 화면에 반영됩니다.' : '임시저장했습니다.');
      await load();
    } catch (err) {
      flash(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const attach = async (mission: PlayMission, file: File) => {
    setBusy(mission.id);
    try {
      const uploaded = await uploadFile(file);
      await put('/play/submission', {
        missionId: mission.id,
        content: drafts[mission.id] ?? '',
        fileUrl: uploaded.url,
        fileName: uploaded.name,
        submit: false
      });
      flash(`첨부 완료: ${uploaded.name}`);
      await load();
    } catch (err) {
      flash(err instanceof Error ? err.message : '업로드에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const ask = async () => {
    if (!question.trim()) return;
    try {
      await post('/play/question', { body: question.trim() });
      setQuestion('');
      flash('질문을 보냈습니다.');
      await load();
    } catch (err) {
      flash(err instanceof Error ? err.message : '질문 전송에 실패했습니다.');
    }
  };

  if (!bundle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-white">
        {error ? (
          <>
            <p className="text-sm text-rose-200">{error}</p>
            <Link to="/join" className="btn-accent">
              다시 입장하기
            </Link>
          </>
        ) : (
          <p className="animate-pulse-soft text-sm text-white/50">불러오는 중…</p>
        )}
      </div>
    );
  }

  const theme = teamTheme(bundle.me.color);
  const timer = liveTimer ?? bundle.screen.timer;
  const stage = bundle.stages.find((item) => item.id === activeStageId) ?? bundle.currentStage;

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {bundle.session.title}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
              <p className="truncate text-sm font-bold text-slate-900">{bundle.me.name}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <Countdown timer={timer} size="md" className="text-slate-900" />
            <p className="text-[10px] text-slate-400">
              {timer.running ? '진행 중' : timer.remainingSec !== null ? '대기' : '—'}
            </p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-xl gap-1.5 overflow-x-auto px-4 pb-2">
          {bundle.stages.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveStageId(item.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                item.id === stage?.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {item.seq}. {item.title}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-4">
        {!stage && (
          <div className="card p-5 text-sm text-slate-500">
            아직 열린 단계가 없습니다. 강사의 안내를 기다려주세요.
          </div>
        )}

        {stage && (
          <section className="card animate-fade-up p-5">
            <div className="flex items-center justify-between gap-2">
              <span className={`chip ${STAGE_STATE_STYLE[stage.state]}`}>
                {STAGE_STATE_LABEL[stage.state]}
              </span>
              <span className="text-[11px] text-slate-400">
                제한시간 {Math.round(stage.timeLimitSec / 60)}분
              </span>
            </div>
            <h1 className="mt-3 text-xl font-black leading-snug text-slate-900">
              {stage.title}
            </h1>
            {stage.goal && <p className="mt-1.5 text-sm text-slate-500">{stage.goal}</p>}
          </section>
        )}

        {stage?.state === 'locked' && (
          <div className="card flex items-center gap-3 p-5 text-sm text-slate-500">
            <span className="text-lg">🔒</span>
            <p>이 단계는 아직 열리지 않았습니다. 이전 단계를 마치면 공개됩니다.</p>
          </div>
        )}

        {stage?.missions.map((mission) => (
          <MissionCard
            key={mission.id}
            mission={mission}
            stageState={stage.state}
            draft={drafts[mission.id] ?? ''}
            busy={busy === mission.id}
            onDraftChange={(value) =>
              setDrafts((prev) => ({ ...prev, [mission.id]: value }))
            }
            onSave={(submit) => void save(mission, submit)}
            onAttach={(file) => void attach(mission, file)}
          />
        ))}

        {!!bundle.announcements.length && (
          <section className="card p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">공지</p>
            <ul className="mt-2 space-y-2">
              {bundle.announcements.map((item) => (
                <li key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {item.pinned && <span className="mr-1 text-rose-500">📌</span>}
                  {item.body}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            강사에게 질문
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="궁금한 점을 남겨주세요"
              maxLength={500}
              className="field min-w-0 flex-1"
            />
            <button type="button" className="btn-primary shrink-0" onClick={() => void ask()}>
              보내기
            </button>
          </div>
          {!!bundle.myQuestions.length && (
            <ul className="mt-3 space-y-2">
              {bundle.myQuestions.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                  <p className="text-slate-700">{item.body}</p>
                  {item.answer ? (
                    <p className="mt-1 rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-800">
                      답변 · {item.answer}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-400">답변 대기 중</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="pb-4 text-center text-[11px] text-slate-400">
          {bundle.session.title} · 입장 코드 {bundle.session.joinCode}
        </p>
      </main>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-30 mx-auto w-fit max-w-[90%] rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

