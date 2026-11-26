import { useCallback, useEffect, useState } from 'react';
import { del, get, patch, post } from '../api';
import Countdown from '../components/Countdown';
import { connectRealtime } from '../socket';
import {
  SCREEN_MODE_LABEL,
  STAGE_STATE_LABEL,
  STAGE_STATE_STYLE,
  formatTime,
  teamTheme
} from '../theme';
import type { AdminBundle, ScreenMode, StageState, TimerView } from '../types';

type Props = { sessionId: string; onBack: () => void };

const MODES: ScreenMode[] = ['idle', 'stage_intro', 'mission', 'lecture', 'review', 'scoreboard'];

export default function AdminConsole({ sessionId, onBack }: Props) {
  const [bundle, setBundle] = useState<AdminBundle | null>(null);
  const [error, setError] = useState('');
  const [liveTimer, setLiveTimer] = useState<TimerView | null>(null);
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackScore, setFeedbackScore] = useState('');
  const [feedbackStar, setFeedbackStar] = useState(false);
  const [minutes, setMinutes] = useState('10');
  const [announcement, setAnnouncement] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await get<AdminBundle>(`/admin/sessions/${sessionId}`);
      setBundle(data);
      setError('');
      setOpenStageId((current) => current ?? data.screen.activeStageId ?? data.stages[0]?.id ?? null);
      setMissionId((current) => current ?? data.screen.activeMissionId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했습니다.');
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const rt = connectRealtime({ sessionId });
    const offRefresh = rt.onRefresh(() => void load());
    const offTimer = rt.onTimer((timer) => setLiveTimer(timer));
    return () => {
      offRefresh();
      offTimer();
      rt.disconnect();
    };
  }, [sessionId, load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(id);
  }, [load]);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2400);
  };

  const act = async (run: () => Promise<unknown>, message?: string) => {
    try {
      await run();
      await load();
      if (message) flash(message);
    } catch (err) {
      flash(err instanceof Error ? err.message : '요청이 실패했습니다.');
    }
  };

  const base = `/admin/sessions/${sessionId}`;

  const setStageState = (stageId: string, state: StageState) =>
    act(() => patch(`${base}/stages/${stageId}`, { state }), `단계 상태 → ${STAGE_STATE_LABEL[state]}`);

  const setScreen = (payload: Record<string, unknown>) =>
    act(() => patch(`${base}/screen`, payload), '메인화면을 전환했습니다.');

  const controlTimer = (action: string) =>
    act(
      () => post(`${base}/timer`, { action, seconds: Math.max(1, Number(minutes) || 10) * 60 }),
      '타이머를 조정했습니다.'
    );

  const showMission = (stageId: string, target: string) => {
    setOpenStageId(stageId);
    setMissionId(target);
    void setScreen({ mode: 'mission', activeStageId: stageId, activeMissionId: target });
  };

  const showSlide = (stageId: string, index: number) => {
    setOpenStageId(stageId);
    void setScreen({ mode: 'lecture', activeStageId: stageId, slideIndex: index });
  };

  const openReview = (submissionId: string, index: number) => {
    setReviewTarget(submissionId);
    void setScreen({
      mode: 'review',
      reviewSubmissionId: submissionId,
      reviewIndex: index
    });
  };

  const sendFeedback = () => {
    if (!reviewTarget) return;
    void act(
      () =>
        post(`${base}/submissions/${reviewTarget}/feedback`, {
          body: feedbackBody,
          score: feedbackScore === '' ? null : Number(feedbackScore),
          isStar: feedbackStar,
          visibleToTeam: true
        }),
      '피드백을 저장했습니다.'
    ).then(() => {
      setFeedbackBody('');
      setFeedbackScore('');
      setFeedbackStar(false);
    });
  };

  const addAnnouncement = () => {
    if (!announcement.trim()) return;
    void act(() => post(`${base}/announcements`, { body: announcement.trim() }), '공지를 보냈습니다.')
      .then(() => setAnnouncement(''));
  };

  const answerQuestion = (questionId: string) => {
    const answer = (answers[questionId] ?? '').trim();
    if (!answer) return;
    void act(() => post(`${base}/questions/${questionId}/answer`, { answer }), '답변했습니다.').then(
      () => setAnswers((prev) => ({ ...prev, [questionId]: '' }))
    );
  };

  if (!bundle) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        {error ? (
          <>
            <p className="text-sm text-rose-300">{error}</p>
            <button type="button" className="btn-accent" onClick={onBack}>
              세션 목록으로
            </button>
          </>
        ) : (
          <p className="animate-pulse-soft text-sm text-white/40">콘솔 준비 중…</p>
        )}
      </div>
    );
  }

  const timer = liveTimer ?? bundle.screen.timer;
  const activeStage = bundle.stages.find((stage) => stage.id === openStageId) ?? bundle.stages[0] ?? null;
  const activeMission =
    bundle.stages.flatMap((stage) => stage.missions).find((item) => item.id === missionId) ??
    activeStage?.missions[0] ??
    null;
  const missionSubs = activeMission
    ? bundle.submissions.filter((item) => item.missionId === activeMission.id)
    : [];
  const selectedSub = bundle.submissions.find((item) => item.id === reviewTarget) ?? null;

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-2 px-5 py-3">
          <button type="button" onClick={onBack} className="btn-ghost btn-xs">
            ← 목록
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-black text-slate-900">
            {bundle.session.title}
          </h1>
          <span className="chip bg-slate-900 text-white">코드 {bundle.session.joinCode}</span>
          <select
            value={bundle.session.status}
            onChange={(event) =>
              void act(() => patch(base, { status: event.target.value }), '상태를 변경했습니다.')
            }
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold"
          >
            <option value="draft">준비중</option>
            <option value="live">진행중</option>
            <option value="closed">종료</option>
          </select>
          <a href={bundle.screenUrl} target="_blank" rel="noreferrer" className="btn-primary btn-xs">
            메인화면 열기
          </a>
          <a href={`${base}/export.xlsx`} className="btn-ghost btn-xs">
            엑셀
          </a>
          <button type="button" className="btn-ghost btn-xs" onClick={() => void load()}>
            새로고침
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1600px] gap-4 px-5 py-4 lg:grid-cols-[21rem_1fr_21rem]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              단계 · 콘텐츠
            </h2>
            <span className="text-xs text-slate-400">{bundle.stages.length}단계</span>
          </div>

          {bundle.stages.map((stage) => {
            const open = stage.id === activeStage?.id;
            return (
              <div
                key={stage.id}
                className={`card overflow-hidden ${open ? 'ring-2 ring-slate-900/10' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setOpenStageId(stage.id)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-black text-white">
                    {stage.seq}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">
                      {stage.title}
                    </span>
                    <span className="block truncate text-[11px] text-slate-400">
                      {stage.goal || '설명 없음'}
                    </span>
                  </span>
                  <span className={`chip shrink-0 ${STAGE_STATE_STYLE[stage.state]}`}>
                    {STAGE_STATE_LABEL[stage.state]}
                  </span>
                </button>

                {open && (
                  <div className="space-y-3 border-t border-slate-100 px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="btn-ghost btn-xs"
                        onClick={() => void setStageState(stage.id, 'open')}
                      >
                        단계 열기
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-xs"
                        onClick={() => void setStageState(stage.id, 'review')}
                      >
                        리뷰로
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-xs"
                        onClick={() => void setStageState(stage.id, 'closed')}
                      >
                        마감
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-xs"
                        onClick={() => void setStageState(stage.id, 'locked')}
                      >
                        잠금
                      </button>
                      <button
                        type="button"
                        className="btn-primary btn-xs"
                        onClick={() =>
                          void setScreen({ mode: 'stage_intro', activeStageId: stage.id })
                        }
                      >
                        소개 화면
                      </button>
                    </div>
                    {!!stage.missions.length && (
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          미션
                        </p>
                        <div className="space-y-1">
                          {stage.missions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => showMission(stage.id, item.id)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                                activeMission?.id === item.id
                                  ? 'bg-slate-900 text-white'
                                  : 'hover:bg-slate-100'
                              }`}
                            >
                              <span className="font-bold">{item.seq}.</span>
                              <span className="min-w-0 flex-1 truncate">
                                {item.title || item.prompt.slice(0, 28)}
                              </span>
                              <span className="shrink-0 opacity-60">
                                {item.submittedCount}/{bundle.teams.length}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {!!stage.slides.length && (
                      <div>
                        <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          강의자료
                        </p>
                        <div className="space-y-1">
                          {stage.slides.map((slide, index) => (
                            <button
                              key={slide.id}
                              type="button"
                              onClick={() => showSlide(stage.id, index)}
                              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                            >
                              <span className="font-bold">{index + 1}</span>
                              <span className="truncate text-slate-600">
                                {slide.content.replace(/[#*]/g, '').slice(0, 40) || slide.type}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
        <section className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                메인화면 제어
              </h2>
              <span className="text-xs text-slate-400">{SCREEN_MODE_LABEL[bundle.screen.mode]}</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    void setScreen({
                      mode,
                      activeStageId: activeStage?.id ?? null,
                      ...(activeMission ? { activeMissionId: activeMission.id } : {})
                    })
                  }
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                    bundle.screen.mode === mode
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {SCREEN_MODE_LABEL[mode]}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Countdown timer={timer} size="md" className="text-slate-900" />
              <input
                type="number"
                min={1}
                max={120}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold"
              />
              <span className="text-[11px] text-slate-400">분</span>
              <button type="button" className="btn-primary btn-xs" onClick={() => controlTimer('start')}>
                시작
              </button>
              <button type="button" className="btn-ghost btn-xs" onClick={() => controlTimer('pause')}>
                일시정지
              </button>
              <button type="button" className="btn-ghost btn-xs" onClick={() => controlTimer('resume')}>
                재개
              </button>
              <button type="button" className="btn-ghost btn-xs" onClick={() => controlTimer('reset')}>
                리셋
              </button>
              <label className="ml-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={bundle.screen.revealTeams}
                  onChange={(event) => void setScreen({ revealTeams: event.target.checked })}
                />
                조 이름 공개
              </label>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  선택된 미션
                </p>
                <p className="truncate text-sm font-bold text-slate-900">
                  {activeMission ? `${activeMission.seq}. ${activeMission.title || activeMission.prompt.slice(0, 40)}` : '미션을 선택하세요'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip bg-emerald-100 text-emerald-700">
                  제출 {bundle.stats.submittedNow}/{bundle.stats.teamCount}
                </span>
                {activeMission && (
                  <button
                    type="button"
                    className="btn-ghost btn-xs"
                    onClick={() =>
                      void setScreen({
                        mode: 'mission',
                        activeMissionId: activeMission.id,
                        activeStageId: activeMission.stageId
                      })
                    }
                  >
                    화면에 표시
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {bundle.activeMissionTeamStatus.length === 0 &&
                bundle.teams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-400"
                  >
                    {team.name}
                  </div>
                ))}
              {bundle.activeMissionTeamStatus.map((status) => {
                const theme = teamTheme(status.color);
                return (
                  <div
                    key={status.teamId}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                      status.status === 'submitted'
                        ? 'bg-emerald-50 text-emerald-700'
                        : status.status === 'draft'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-50 text-slate-400'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                    <span className="truncate">{status.teamName}</span>
                    <span className="ml-auto shrink-0 text-[10px]">
                      {status.status === 'submitted' ? '제출' : status.status === 'draft' ? '작성' : '대기'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                제출물 · 리뷰
              </h2>
              <span className="text-xs text-slate-400">{missionSubs.length}건</span>
            </div>

            <div className="mt-3 space-y-2">
              {missionSubs.length === 0 && (
                <p className="text-xs text-slate-400">아직 제출물이 없습니다.</p>
              )}
              {missionSubs.map((sub, index) => {
                const theme = teamTheme(sub.teamColor);
                const selected = selectedSub?.id === sub.id;
                return (
                  <div
                    key={sub.id}
                    className={`rounded-xl border px-3 py-2 ${
                      selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                      <p className="text-xs font-bold text-slate-900">{sub.teamName}</p>
                      <span
                        className={`chip ${
                          sub.status === 'submitted'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {sub.status === 'submitted' ? '제출' : '작성중'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {sub.submittedAt ? formatTime(sub.submittedAt) : '-'}
                      </span>
                      <button
                        type="button"
                        onClick={() => openReview(sub.id, index)}
                        className="btn-primary btn-xs ml-auto"
                      >
                        리뷰
                      </button>
                    </div>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs text-slate-600">
                      {sub.content || '(내용 없음)'}
                    </p>
                  </div>
                );
              })}
            </div>

            {selectedSub && (
              <div className="mt-4 space-y-2 rounded-xl bg-slate-900 p-3 text-white">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
                  {selectedSub.teamName} 피드백
                </p>
                <textarea
                  value={feedbackBody}
                  onChange={(event) => setFeedbackBody(event.target.value)}
                  rows={3}
                  placeholder="피드백을 입력하세요"
                  className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={feedbackScore}
                    onChange={(event) => setFeedbackScore(event.target.value)}
                    placeholder="점수"
                    className="w-20 rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/30"
                  />
                  <label className="flex items-center gap-1 text-xs text-white/60">
                    <input
                      type="checkbox"
                      checked={feedbackStar}
                      onChange={(event) => setFeedbackStar(event.target.checked)}
                    />
                    우수
                  </label>
                  <button type="button" onClick={sendFeedback} className="btn-accent btn-xs ml-auto">
                    저장
                  </button>
                </div>
                {!!selectedSub.feedbacks.length && (
                  <ul className="space-y-1 border-t border-white/10 pt-2 text-xs text-white/70">
                    {selectedSub.feedbacks.map((item) => (
                      <li key={item.id}>
                        · {item.isStar ? '⭐ ' : ''}
                        {item.score !== null ? `${item.score}점 ` : ''}
                        {item.body}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
        <section className="space-y-4">
          <div className="card p-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">참여 안내</h2>
            <div className="mt-3 flex items-start gap-3">
              <img
                src={`/api/public/qr?data=${encodeURIComponent(bundle.joinUrl)}`}
                alt="참여 QR"
                className="h-24 w-24 shrink-0 rounded-lg border border-slate-200"
              />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">입장 코드</p>
                <p className="font-mono text-xl font-black tracking-[0.2em] text-slate-900">
                  {bundle.session.joinCode}
                </p>
                <p className="mt-1 break-all text-[10px] leading-snug text-slate-400">
                  {bundle.joinUrl}
                </p>
                <button
                  type="button"
                  className="btn-ghost btn-xs mt-2"
                  onClick={() => {
                    void navigator.clipboard?.writeText(bundle.joinUrl);
                    flash('참여 링크를 복사했습니다.');
                  }}
                >
                  링크 복사
                </button>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500">
              조 {bundle.teams.length}개 · 제출 {bundle.stats.totalSubmitted}건
            </p>
          </div>

          <div className="card p-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              공지 브로드캐스트
            </h2>
            <div className="mt-2 flex gap-1.5">
              <input
                value={announcement}
                onChange={(event) => setAnnouncement(event.target.value)}
                placeholder="전체 공지 입력"
                maxLength={500}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-900"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addAnnouncement();
                }}
              />
              <button type="button" className="btn-primary btn-xs shrink-0" onClick={addAnnouncement}>
                전송
              </button>
            </div>
            <ul className="mt-2 space-y-1.5">
              {bundle.announcements.slice(0, 6).map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
                >
                  <span className="min-w-0 flex-1 break-words">{item.body}</span>
                  <button
                    type="button"
                    className="shrink-0 text-slate-300 hover:text-rose-500"
                    onClick={() =>
                      void act(() => del(`${base}/announcements/${item.id}`), '공지를 삭제했습니다.')
                    }
                  >
                    ✕
                  </button>
                </li>
              ))}
              {!bundle.announcements.length && (
                <li className="text-[11px] text-slate-400">등록된 공지가 없습니다.</li>
              )}
            </ul>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
                교육생 질문
              </h2>
              <span className="text-[10px] text-slate-400">
                대기 {bundle.questions.filter((item) => item.status === 'open').length}건
              </span>
            </div>
            <ul className="mt-2 space-y-2">
              {bundle.questions.map((item) => (
                <li key={item.id} className="rounded-lg border border-slate-200 px-2.5 py-2">
                  <p className="text-[11px] font-bold text-slate-500">
                    {item.teamName ?? '익명'} · {formatTime(item.createdAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-800">{item.body}</p>
                  {item.status === 'answered' ? (
                    <p className="mt-1 rounded bg-sky-50 px-2 py-1 text-[11px] text-sky-800">
                      답변 · {item.answer}
                    </p>
                  ) : (
                    <div className="mt-1 flex gap-1.5">
                      <input
                        value={answers[item.id] ?? ''}
                        onChange={(event) =>
                          setAnswers((prev) => ({ ...prev, [item.id]: event.target.value }))
                        }
                        placeholder="답변 입력"
                        className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-[11px] outline-none focus:border-slate-900"
                      />
                      <button
                        type="button"
                        className="btn-primary btn-xs shrink-0"
                        onClick={() => answerQuestion(item.id)}
                      >
                        등록
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {!bundle.questions.length && (
                <li className="text-[11px] text-slate-400">아직 질문이 없습니다.</li>
              )}
            </ul>
          </div>

          <button
            type="button"
            className="btn-ghost w-full text-xs"
            onClick={() => {
              if (window.confirm('연습용: 모든 제출물과 질문을 초기화할까요?')) {
                void act(() => post(`${base}/reset-submissions`), '제출물을 초기화했습니다.');
              }
            }}
          >
            제출물 초기화 (리허설)
          </button>
        </section>
      </main>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[90%] rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

