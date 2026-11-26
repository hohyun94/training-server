import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { del, get, post } from '../api';
import { formatTime } from '../theme';
import type { SessionListItem } from '../types';
import AdminConsole from './AdminConsole';

export default function Admin() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState('방법론 실습');
  const [teamNames, setTeamNames] = useState('1조, 2조, 3조, 4조');
  const [busy, setBusy] = useState(false);

  const loadSessions = useCallback(async () => {
    const data = await get<{ sessions: SessionListItem[] }>('/admin/sessions');
    setSessions(data.sessions);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const me = await get<{ instructor: boolean }>('/auth/me');
        setAuthed(me.instructor);
        if (me.instructor) await loadSessions();
      } catch {
        setAuthed(false);
      } finally {
        setChecking(false);
      }
    })();
  }, [loadSessions]);

  const login = async () => {
    setBusy(true);
    setError('');
    try {
      await post('/auth/login', { password });
      setAuthed(true);
      setPassword('');
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const createSession = async () => {
    setBusy(true);
    setError('');
    try {
      const names = teamNames
        .split(/[,\n]/)
        .map((name) => name.trim())
        .filter(Boolean);
      const created = await post<{ session: { id: string } }>('/admin/sessions', {
        title: title.trim(),
        teamNames: names
      });
      await loadSessions();
      setSessionId(created.session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '교육 회차를 만들지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const removeSession = async (id: string) => {
    if (!window.confirm('이 교육 회차와 모든 제출물을 삭제할까요?')) return;
    await del(`/admin/sessions/${id}`);
    await loadSessions();
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-white/40">
        확인 중…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5">
        <div className="w-full max-w-sm">
          <Link to="/" className="text-xs text-white/40 hover:text-white/70">
            ← 처음으로
          </Link>
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-sky-300/70">
              Instructor
            </p>
            <h1 className="mt-2 text-2xl font-black text-white">강사 콘솔</h1>
            <p className="mt-1 text-sm text-white/40">비밀번호로 로그인하세요.</p>

            <form
              className="mt-6 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void login();
              }}
            >
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호"
                autoFocus
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-sky-400"
              />
              <button type="submit" className="btn-accent w-full" disabled={busy}>
                로그인
              </button>
            </form>
            {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (sessionId) {
    return (
      <AdminConsole
        sessionId={sessionId}
        onBack={() => {
          setSessionId(null);
          void loadSessions();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 py-4">
          <Link to="/" className="text-xs text-slate-400 hover:text-slate-700">
            ← 홈
          </Link>
          <h1 className="flex-1 text-base font-black text-slate-900">강사 콘솔</h1>
          <button
            type="button"
            className="btn-ghost btn-xs"
            onClick={() => {
              void post('/auth/logout').then(() => setAuthed(false));
            }}
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-5xl gap-4 px-5 py-5 lg:grid-cols-[1fr_20rem]">
        <section className="space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">교육 회차</h2>

          {!sessions.length && (
            <div className="card p-6 text-sm text-slate-500">
              아직 만든 교육이 없습니다. 오른쪽에서 새 회차를 만들어주세요.
            </div>
          )}

          {sessions.map((session) => (
            <div key={session.id} className="card flex flex-wrap items-center gap-2 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-slate-900">{session.title}</p>
                  <span className="chip bg-slate-100 text-slate-500">
                    {session.status === 'live'
                      ? '진행중'
                      : session.status === 'closed'
                        ? '종료'
                        : '준비중'}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  코드 {session.joinCode} · 조 {session.teamCount}개 · {formatTime(session.createdAt)}
                </p>
              </div>
              <button
                type="button"
                className="btn-primary btn-xs"
                onClick={() => setSessionId(session.id)}
              >
                콘솔 열기
              </button>
              <a
                href={`/screen/${session.joinCode}`}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost btn-xs"
              >
                메인화면
              </a>
              <button
                type="button"
                className="btn-ghost btn-xs text-rose-500"
                onClick={() => void removeSession(session.id)}
              >
                삭제
              </button>
            </div>
          ))}
        </section>

        <aside className="card h-fit p-5">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            새 교육 만들기
          </h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="label">교육 이름</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="field"
                maxLength={120}
              />
            </div>
            <div>
              <label className="label">조 이름 (쉼표로 구분)</label>
              <textarea
                value={teamNames}
                onChange={(event) => setTeamNames(event.target.value)}
                rows={3}
                className="field resize-y"
              />
            </div>
            <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-500">
              5단계 기본 템플릿으로 생성됩니다. 콘텐츠는 콘솔에서 교체하거나 API로 한 번에 넣을 수
              있습니다.
            </p>
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => void createSession()}
              disabled={busy || !title.trim()}
            >
              만들기
            </button>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        </aside>
      </main>
    </div>
  );
}
