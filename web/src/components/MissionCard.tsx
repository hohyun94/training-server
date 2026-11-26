import { formatTime } from '../theme';
import type { PlayMission, StageState } from '../types';

type Props = {
  mission: PlayMission;
  stageState: StageState;
  draft: string;
  busy: boolean;
  onDraftChange: (value: string) => void;
  onSave: (submit: boolean) => void;
  onAttach: (file: File) => void;
};

const SINGLE_LINE = new Set(['text', 'url', 'number']);

export default function MissionCard({
  mission,
  stageState,
  draft,
  busy,
  onDraftChange,
  onSave,
  onAttach
}: Props) {
  const submission = mission.submission;
  const submitted = submission?.status === 'submitted';
  const editable = mission.allowEdit || !submitted;
  const canEdit = stageState === 'open' && editable;

  return (
    <article className="card animate-fade-up p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
          미션 {mission.seq}
          {mission.required ? '' : ' · 선택'}
        </p>
        <span
          className={`chip ${
            submitted
              ? 'bg-emerald-100 text-emerald-700'
              : submission
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          {submitted ? '제출 완료' : submission ? '작성 중' : '미제출'}
        </span>
      </div>

      {mission.title && (
        <h2 className="mt-1 text-base font-bold text-slate-900">{mission.title}</h2>
      )}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {mission.prompt}
      </p>

      <div className="mt-4 space-y-3">
        {mission.inputType === 'choice' ? (
          <div className="space-y-2">
            {mission.options.map((option) => {
              const checked = draft === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={busy || !canEdit}
                  onClick={() => onDraftChange(option)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition ${
                    checked
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full border ${
                      checked ? 'border-white' : 'border-slate-300'
                    }`}
                  >
                    {checked && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        ) : SINGLE_LINE.has(mission.inputType) ? (
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={busy || !canEdit}
            maxLength={mission.maxLen}
            inputMode={mission.inputType === 'number' ? 'numeric' : 'text'}
            placeholder={mission.inputType === 'url' ? 'https://…' : '답안을 입력하세요'}
            className="field"
          />
        ) : (
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            disabled={busy || !canEdit}
            maxLength={mission.maxLen}
            rows={5}
            placeholder="답안을 입력하세요"
            className="field resize-y"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={busy}
                onClick={() => onSave(true)}
              >
                {submitted ? '다시 제출' : '제출하기'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => onSave(false)}
              >
                임시저장
              </button>
            </>
          )}
          {canEdit && (mission.inputType === 'file' || mission.inputType === 'longtext') && (
            <label className="btn-ghost cursor-pointer">
              파일 첨부
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onAttach(file);
                  event.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        {submission?.fileUrl && (
          <a
            href={submission.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            📎 {submission.fileName ?? '첨부파일'}
          </a>
        )}

        <p className="text-[11px] text-slate-400">
          {mission.maxLen}자 이내
          {submission?.submittedAt ? ` · ${formatTime(submission.submittedAt)} 제출` : ''}
        </p>

        {!!submission?.feedbacks.length && (
          <div className="space-y-2 rounded-xl bg-amber-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              강사 피드백
            </p>
            {submission.feedbacks.map((feedback) => (
              <p key={feedback.id} className="text-sm text-amber-900">
                {feedback.isStar && '⭐ '}
                {feedback.score !== null && (
                  <span className="mr-1 font-bold">{feedback.score}점</span>
                )}
                {feedback.body}
              </p>
            ))}
          </div>
        )}

        {stageState !== 'open' && stageState !== 'locked' && !submitted && (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            이 단계는 제출이 마감되었습니다.
          </p>
        )}
      </div>
    </article>
  );
}

