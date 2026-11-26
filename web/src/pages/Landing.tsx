import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Landing() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -left-32 -top-40 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.45em] text-sky-300/80">
          Methodology Lab
        </p>
        <h1 className="mt-5 text-4xl font-black leading-[1.15] sm:text-5xl">
          5단계 실습 진행 서버
        </h1>
        <p className="mt-4 max-w-xl text-white/60">
          조별 미션 제출 → 강사 리뷰 → 강의자료 공유까지 하나의 화면에서. 입장 코드를 입력하면
          조 선택 화면으로 이동합니다.
        </p>

        <form
          className="mt-10 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const target = code.trim().toUpperCase();
            if (target) navigate(`/join?code=${encodeURIComponent(target)}`);
          }}
        >
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="입장 코드 (예: DEMO01)"
            maxLength={12}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-lg font-semibold tracking-[0.2em] text-white outline-none transition placeholder:text-base placeholder:tracking-normal placeholder:text-white/30 focus:border-sky-400"
          />
          <button type="submit" className="btn-accent shrink-0 px-7 py-3.5 text-base">
            입장하기
          </button>
        </form>

        <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-white/50">
          <Link
            to="/admin"
            className="rounded-lg border border-white/15 px-3 py-2 transition hover:bg-white/5"
          >
            강사 콘솔
          </Link>
          <Link
            to="/screen/DEMO01"
            className="rounded-lg border border-white/15 px-3 py-2 transition hover:bg-white/5"
          >
            데모 메인화면
          </Link>
          <span className="text-xs text-white/30">모바일 · 노트북 모두 지원</span>
        </div>
      </main>
    </div>
  );
}
