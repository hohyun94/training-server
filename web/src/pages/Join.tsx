import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { get, post } from '../api';
import { teamTheme } from '../theme';
import type { PublicSessionInfo } from '../types';

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode] = useState((params.get('code') ?? '').toUpperCase());
  const [info, setInfo] = useState<PublicSessionInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newTeam, setNewTeam] = useState('');
  const [members, setMembers] = useState('');

  const lookup = useCallback(async (target: string) => {
    const normalized = target.trim().toUpperCase();
    if (!normalized) return;
    setLoading(true);
    setError('');
    try {
      const data = await get<PublicSessionInfo>(`/public/session/${encodeURIComponent(normalized)}`);
      setInfo(data);
    } catch (err) {
      setInfo(null);
      setError(err instanceof Error ? err.message : '입장 코드를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = params.get('code');
    if (initial) void lookup(initial);
  }, [params, lookup]);

  const join = async (payload: { teamId?: string; teamName?: string }) => {
    if (!info) return;
    setLoading(true);
    setError('');
    try {
      await post('/public/join', {
        joinCode: info.session.joinCode,
        members: members.trim() || undefined,
        ...payload
      });
      navigate('/play');
    } catch (err) {
      setError(err instanceof Error ? err.message : '입장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-md">
        <Link to="/" className="text-xs text-white/40 hover:text-white/70">
          ← 처음으로
        </Link>

        <h1 className="mt-6 text-2xl font-black">실습 입장</h1>
        <p className="mt-1 text-sm text-white/50">
          입장 코드를 입력하고, 우리 조를 선택해주세요.
        </p>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(code);
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="입장 코드"
            maxLength={12}
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base font-semibold tracking-[0.2em] text-white outline-none placeholder:tracking-normal placeholder:text-white/30 focus:border-sky-400"
          />
          <button type="submit" className="btn-accent shrink-0 px-4" disabled={loading}>
            확인
          </button>
        </form>

        {error && (
          <p className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2 text-sm text-rose-200">{error}</p>
        )}

        {info && (
          <div className="mt-8 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-300/70">Session</p>
              <h2 className="mt-1 text-xl font-bold">{info.session.title}</h2>
              <p className="text-xs text-white/40">코드 {info.session.joinCode}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                우리 조 선택
              </p>
              <div className="grid grid-cols-2 gap-2">
                {info.teams.map((team) => {
                  const theme = teamTheme(team.color);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => void join({ teamId: team.id })}
                      disabled={loading}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-semibold transition hover:border-white/25 hover:bg-white/10"
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
                      <span className="truncate">{team.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                조가 없나요? 새로 만들기
              </p>
              <div className="space-y-2">
                <input
                  value={newTeam}
                  onChange={(event) => setNewTeam(event.target.value)}
                  placeholder="조 이름 (예: 5조)"
                  maxLength={24}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-sky-400"
                />
                <input
                  value={members}
                  onChange={(event) => setMembers(event.target.value)}
                  placeholder="팀원 이름 (선택)"
                  maxLength={160}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-sky-400"
                />
                <button
                  type="button"
                  className="btn-accent w-full"
                  disabled={loading || !newTeam.trim()}
                  onClick={() => void join({ teamName: newTeam.trim() })}
                >
                  이 조로 입장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
