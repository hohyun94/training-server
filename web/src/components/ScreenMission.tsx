import Countdown from './Countdown';
import { teamTheme } from '../theme';
import type { ScreenBundle } from '../types';

export default function MissionPanel({ bundle }: { bundle: ScreenBundle }) {
  const mission = bundle.mission;
  const submittedTeams = bundle.teams.filter((team) => team.submitted).length;

  return (
    <div className="flex flex-1 flex-col gap-7 px-10 py-8">
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-sky-300/70">
            Mission {mission?.seq ?? ''}
          </p>
          <h2 className="mt-2 text-4xl font-black leading-tight">{mission?.title || '미션'}</h2>
          <p className="mt-3 max-w-4xl whitespace-pre-wrap text-2xl leading-relaxed text-white/70">
            {mission?.prompt}
          </p>
          {mission && (
            <p className="mt-3 text-sm text-white/30">
              {mission.inputType === 'file'
                ? '도구 결과물(파일)을 첨부해 제출'
                : mission.inputType === 'choice'
                  ? '보기 중 하나를 선택'
                  : `최대 ${mission.maxLen}자`}
            </p>
          )}
        </div>

        <div className="shrink-0 rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-center">
          <Countdown timer={bundle.screen.timer} size="xl" className="text-white" />
          <p className="mt-2 text-xs uppercase tracking-widest text-white/40">남은 시간</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-4">
        <p className="text-sm uppercase tracking-widest text-white/40">제출 현황</p>
        <p className="text-sm font-semibold text-white/60">
          {submittedTeams} / {bundle.teams.length} 조
        </p>
      </div>

      <div className="grid flex-1 auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-4">
        {bundle.teams.map((team) => {
          const submission = bundle.submissions.find((item) => item.teamId === team.id);
          const theme = teamTheme(team.color);
          const done = submission?.status === 'submitted';
          return (
            <div
              key={team.id}
              className={`flex flex-col rounded-2xl border p-5 transition ${
                done
                  ? 'border-white/20 bg-white/[0.07]'
                  : 'border-dashed border-white/10 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.dot}`} />
                  <p className="truncate font-bold">
                    {bundle.screen.revealTeams ? team.name : '익명 조'}
                  </p>
                </div>
                <span
                  className={`chip shrink-0 ${
                    done ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/5 text-white/40'
                  }`}
                >
                  {done ? '제출' : '대기'}
                </span>
              </div>
              <p className="mt-3 line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-white/60">
                {submission?.content || '아직 제출하지 않았습니다.'}
              </p>
              {submission?.fileName && (
                <p className="mt-3 truncate text-xs text-sky-300/70">📎 {submission.fileName}</p>
              )}
            </div>
          );
        })}
        {!bundle.teams.length && (
          <p className="col-span-full text-sm text-white/40">
            아직 입장한 조가 없습니다. QR 코드로 참여를 안내해주세요.
          </p>
        )}
      </div>
    </div>
  );
}
