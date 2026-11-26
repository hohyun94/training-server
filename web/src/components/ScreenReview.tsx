import { teamTheme } from '../theme';
import type { ScreenBundle } from '../types';

export function ReviewPanel({ bundle }: { bundle: ScreenBundle }) {
  const submission = bundle.reviewSubmission;

  if (!submission) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/40">
        <p className="text-lg">아직 리뷰할 제출물이 없습니다.</p>
        <p className="text-sm text-white/25">교육생이 제출하면 이 화면에 나타납니다.</p>
      </div>
    );
  }

  const theme = teamTheme(submission.teamColor);
  const index = bundle.submissions.findIndex((item) => item.id === submission.id);

  return (
    <div className="flex flex-1 flex-col gap-6 px-12 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`h-4 w-4 rounded-full ${theme.dot}`} />
          <h2 className="text-3xl font-black">
            {bundle.screen.revealTeams ? submission.teamName : '익명 조'}
          </h2>
          {submission.feedbacks.some((feedback) => feedback.isStar) && (
            <span className="text-2xl">⭐</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-white/40">
          <span>
            {Math.max(index, 0) + 1} / {bundle.submissions.length}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1">👍 {submission.votes}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <p className="whitespace-pre-wrap text-2xl leading-relaxed text-white/90">
          {submission.content || '(첨부파일 참조)'}
        </p>
        {submission.fileUrl && (
          <a
            href={submission.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-500/25"
          >
            📎 {submission.fileName ?? '첨부파일 열기'}
          </a>
        )}
      </div>

      {!!submission.feedbacks.length && (
        <div className="flex flex-wrap gap-3">
          {submission.feedbacks.map((feedback) => (
            <div
              key={feedback.id}
              className="max-w-md rounded-2xl bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
            >
              {feedback.score !== null && (
                <span className="mr-1 font-bold">{feedback.score}점</span>
              )}
              {feedback.body}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScoreboardPanel({ bundle }: { bundle: ScreenBundle }) {
  const rows = [...bundle.teams].sort((a, b) => b.submittedCount - a.submittedCount);
  const max = Math.max(1, bundle.stage?.missions.length ?? 1);

  return (
    <div className="flex flex-1 flex-col gap-6 px-16 py-10">
      <div className="flex items-end justify-between">
        <h2 className="text-4xl font-black">단계 진행 현황</h2>
        <p className="text-sm text-white/40">{bundle.stage?.title}</p>
      </div>

      <div className="space-y-4">
        {rows.map((team) => {
          const theme = teamTheme(team.color);
          const ratio = Math.min(100, Math.round((team.submittedCount / max) * 100));
          return (
            <div key={team.id} className="flex items-center gap-6">
              <div className="flex w-48 shrink-0 items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${theme.dot}`} />
                <p className="truncate text-lg font-bold">{team.name}</p>
              </div>
              <div className="h-6 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${theme.gradient} transition-all duration-700`}
                  style={{ width: `${ratio}%` }}
                />
              </div>
              <p className="w-16 shrink-0 text-right text-lg font-black tabular-nums">
                {team.submittedCount}
                <span className="text-sm font-medium text-white/30">/{max}</span>
              </p>
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-white/40">참여한 조가 없습니다.</p>}
      </div>
    </div>
  );
}
