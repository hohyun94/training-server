import { asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  announcements,
  feedbacks,
  missions,
  questions,
  screenStates,
  sessions,
  slides,
  stages,
  submissions,
  teams,
  votes,
  type AnnouncementRow,
  type FeedbackRow,
  type MissionRow,
  type QuestionRow,
  type ScreenStateRow,
  type SessionRow,
  type SlideRow,
  type StageRow,
  type SubmissionRow,
  type TeamRow,
  type VoteRow
} from '../db/schema.js';
import { timerView, type TimerView } from './timer.js';

export type SessionData = {
  session: SessionRow;
  screen: ScreenStateRow;
  teams: TeamRow[];
  stages: StageRow[];
  missions: MissionRow[];
  slides: SlideRow[];
  submissions: SubmissionRow[];
  feedbacks: FeedbackRow[];
  votes: VoteRow[];
  announcements: AnnouncementRow[];
  questions: QuestionRow[];
};

export async function ensureScreenState(sessionId: string): Promise<ScreenStateRow> {
  const [existing] = await db
    .select()
    .from(screenStates)
    .where(eq(screenStates.sessionId, sessionId));
  if (existing) return existing;

  const [created] = await db
    .insert(screenStates)
    .values({ sessionId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [again] = await db
    .select()
    .from(screenStates)
    .where(eq(screenStates.sessionId, sessionId));
  return again;
}

export async function loadSessionData(sessionId: string): Promise<SessionData | null> {
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  if (!session) return null;

  const screen = await ensureScreenState(sessionId);

  const teamRows = await db
    .select()
    .from(teams)
    .where(eq(teams.sessionId, sessionId))
    .orderBy(asc(teams.createdAt));

  const stageRows = await db
    .select()
    .from(stages)
    .where(eq(stages.sessionId, sessionId))
    .orderBy(asc(stages.seq));

  const stageIds = stageRows.map((s) => s.id);
  const missionRows = stageIds.length
    ? await db
        .select()
        .from(missions)
        .where(inArray(missions.stageId, stageIds))
        .orderBy(asc(missions.seq))
    : [];

  const slideRows = stageIds.length
    ? await db
        .select()
        .from(slides)
        .where(inArray(slides.stageId, stageIds))
        .orderBy(asc(slides.seq))
    : [];

  const teamIds = teamRows.map((t) => t.id);
  const submissionRows = teamIds.length
    ? await db.select().from(submissions).where(inArray(submissions.teamId, teamIds))
    : [];

  const submissionIds = submissionRows.map((s) => s.id);
  const feedbackRows = submissionIds.length
    ? await db
        .select()
        .from(feedbacks)
        .where(inArray(feedbacks.submissionId, submissionIds))
        .orderBy(asc(feedbacks.createdAt))
    : [];

  const voteRows = submissionIds.length
    ? await db.select().from(votes).where(inArray(votes.submissionId, submissionIds))
    : [];

  const announcementRows = await db
    .select()
    .from(announcements)
    .where(eq(announcements.sessionId, sessionId))
    .orderBy(desc(announcements.createdAt));

  const questionRows = await db
    .select()
    .from(questions)
    .where(eq(questions.sessionId, sessionId))
    .orderBy(asc(questions.createdAt));

  return {
    session,
    screen,
    teams: teamRows,
    stages: stageRows,
    missions: missionRows,
    slides: slideRows,
    submissions: submissionRows,
    feedbacks: feedbackRows,
    votes: voteRows,
    announcements: announcementRows,
    questions: questionRows
  };
}

/** 클라이언트와 공유하는 뷰 타입 */
export type MissionView = {
  id: string;
  stageId: string;
  seq: number;
  title: string;
  prompt: string;
  inputType: string;
  options: string[];
  maxLen: number;
  allowEdit: boolean;
  required: boolean;
};

export type SlideView = {
  id: string;
  seq: number;
  type: string;
  content: string;
  notes: string;
};

export type FeedbackView = {
  id: string;
  body: string;
  score: number | null;
  isStar: boolean;
  visibleToTeam: boolean;
  createdAt: string;
};

export type SubmissionView = {
  id: string;
  missionId: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  feedbacks: FeedbackView[];
  votes: number;
};

export function toFeedbackView(row: FeedbackRow): FeedbackView {
  return {
    id: row.id,
    body: row.body,
    score: row.score,
    isStar: row.isStar,
    visibleToTeam: row.visibleToTeam,
    createdAt: row.createdAt.toISOString()
  };
}

export function toSubmissionView(
  row: SubmissionRow,
  teamRows: TeamRow[],
  feedbackRows: FeedbackRow[],
  voteRows: VoteRow[]
): SubmissionView {
  const team = teamRows.find((t) => t.id === row.teamId);
  return {
    id: row.id,
    missionId: row.missionId,
    teamId: row.teamId,
    teamName: team?.name ?? '알 수 없는 조',
    teamColor: team?.color ?? 'sky',
    content: row.content,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    status: row.status,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
    feedbacks: feedbackRows.filter((f) => f.submissionId === row.id).map(toFeedbackView),
    votes: voteRows.filter((v) => v.submissionId === row.id).length
  };
}

export function toMissionView(row: MissionRow): MissionView {
  return {
    id: row.id,
    stageId: row.stageId,
    seq: row.seq,
    title: row.title,
    prompt: row.prompt,
    inputType: row.inputType,
    options: row.options ?? [],
    maxLen: row.maxLen,
    allowEdit: row.allowEdit,
    required: row.required
  };
}

export function toSlideView(row: SlideRow): SlideView {
  return { id: row.id, seq: row.seq, type: row.type, content: row.content, notes: row.notes };
}

export type { TimerView };

export type StageSummaryView = {
  id: string;
  seq: number;
  title: string;
  goal: string;
  state: string;
  timeLimitSec: number;
  missionCount: number;
};

export type TeamStatusView = {
  id: string;
  name: string;
  color: string;
  members: string;
  submitted: boolean;
  submittedCount: number;
  missionCount: number;
};

function announcementView(row: AnnouncementRow) {
  return {
    id: row.id,
    body: row.body,
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString()
  };
}

export function buildScreenBundle(data: SessionData) {
  const { session, screen, teams: teamRows, stages: stageRows, missions: missionRows } = data;

  const activeStage =
    stageRows.find((s) => s.id === screen.activeStageId) ??
    stageRows.find((s) => s.state === 'open') ??
    stageRows.find((s) => s.state === 'review') ??
    stageRows[0] ??
    null;

  const stageMissions = activeStage
    ? missionRows.filter((m) => m.stageId === activeStage.id).sort((a, b) => a.seq - b.seq)
    : [];

  const activeMission =
    stageMissions.find((m) => m.id === screen.activeMissionId) ?? stageMissions[0] ?? null;

  const stageSlides = activeStage
    ? data.slides.filter((s) => s.stageId === activeStage.id).sort((a, b) => a.seq - b.seq)
    : [];

  const missionSubs = activeMission
    ? data.submissions.filter((s) => s.missionId === activeMission.id)
    : [];

  const submissionsView = missionSubs
    .map((s) => toSubmissionView(s, teamRows, data.feedbacks, data.votes))
    .sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));

  const teamsView: TeamStatusView[] = teamRows.map((t) => {
    const mySubs = data.submissions.filter((s) => s.teamId === t.id);
    const mine = activeMission ? mySubs.filter((s) => s.missionId === activeMission.id) : [];
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      members: t.members,
      submitted: mine.some((s) => s.status === 'submitted'),
      submittedCount: activeMission
        ? mine.filter((s) => s.status === 'submitted').length
        : mySubs.filter((s) => s.status === 'submitted').length,
      missionCount: stageMissions.length
    };
  });

  return {
    session: {
      id: session.id,
      title: session.title,
      joinCode: session.joinCode,
      status: session.status
    },
    screen: {
      mode: screen.mode,
      activeStageId: activeStage?.id ?? null,
      activeMissionId: activeMission?.id ?? null,
      reviewSubmissionId: screen.reviewSubmissionId,
      reviewIndex: screen.reviewIndex,
      slideIndex: screen.slideIndex,
      revealTeams: screen.revealTeams,
      timer: timerView(screen),
      updatedAt: screen.updatedAt.toISOString()
    },
    stages: stageRows.map(
      (s): StageSummaryView => ({
        id: s.id,
        seq: s.seq,
        title: s.title,
        goal: s.goal,
        state: s.state,
        timeLimitSec: s.timeLimitSec,
        missionCount: missionRows.filter((m) => m.stageId === s.id).length
      })
    ),
    stage: activeStage
      ? {
          id: activeStage.id,
          seq: activeStage.seq,
          title: activeStage.title,
          goal: activeStage.goal,
          state: activeStage.state,
          timeLimitSec: activeStage.timeLimitSec,
          missions: stageMissions.map(toMissionView),
          slides: stageSlides.map(toSlideView)
        }
      : null,
    mission: activeMission ? toMissionView(activeMission) : null,
    slide: stageSlides[screen.slideIndex] ?? stageSlides[0] ?? null,
    submissions: submissionsView,
    teams: teamsView,
    reviewSubmission: submissionsView.find((s) => s.id === screen.reviewSubmissionId) ?? null,
    announcements: data.announcements.slice(0, 4).map(announcementView)
  };
}

export function buildPlayBundle(data: SessionData, teamId: string) {
  const myTeam = data.teams.find((t) => t.id === teamId);
  if (!myTeam) return null;

  const mySubs = data.submissions.filter((s) => s.teamId === teamId);
  const myFeedbacks = data.feedbacks.filter(
    (f) => f.visibleToTeam && mySubs.some((s) => s.id === f.submissionId)
  );

  const stagesView = data.stages.map((st) => ({
    id: st.id,
    seq: st.seq,
    title: st.title,
    goal: st.goal,
    state: st.state,
    timeLimitSec: st.timeLimitSec,
    missions:
      st.state === 'locked'
        ? []
        : data.missions
            .filter((m) => m.stageId === st.id)
            .sort((a, b) => a.seq - b.seq)
            .map((m) => {
              const sub = mySubs.find((s) => s.missionId === m.id) ?? null;
              return {
                ...toMissionView(m),
                submission: sub
                  ? {
                      id: sub.id,
                      content: sub.content,
                      fileUrl: sub.fileUrl,
                      fileName: sub.fileName,
                      status: sub.status,
                      submittedAt: sub.submittedAt ? sub.submittedAt.toISOString() : null,
                      updatedAt: sub.updatedAt.toISOString(),
                      feedbacks: myFeedbacks
                        .filter((f) => f.submissionId === sub.id)
                        .map(toFeedbackView)
                    }
                  : null
              };
            })
  }));

  const currentStage =
    stagesView.find((s) => s.state === 'open') ??
    stagesView.find((s) => s.state === 'review') ??
    null;

  const activeMissionId = data.screen.activeMissionId;

  return {
    session: {
      id: data.session.id,
      title: data.session.title,
      joinCode: data.session.joinCode,
      status: data.session.status
    },
    me: {
      teamId: myTeam.id,
      name: myTeam.name,
      color: myTeam.color,
      members: myTeam.members
    },
    screen: {
      mode: data.screen.mode,
      activeStageId: currentStage?.id ?? null,
      activeMissionId,
      timer: timerView(data.screen)
    },
    currentStage,
    stages: stagesView,
    announcements: data.announcements.slice(0, 6).map(announcementView),
    myQuestions: data.questions
      .filter((q) => q.teamId === teamId)
      .map((q) => ({
        id: q.id,
        body: q.body,
        answer: q.answer,
        status: q.status,
        createdAt: q.createdAt.toISOString()
      }))
  };
}

export function buildAdminBundle(data: SessionData) {
  const { session, screen, teams: teamRows, stages: stageRows } = data;

  const activeStageId =
    screen.activeStageId ?? stageRows.find((s) => s.state === 'open')?.id ?? null;
  const activeStage = stageRows.find((s) => s.id === activeStageId) ?? null;
  const activeMissionId = screen.activeMissionId ?? null;

  const submissionsView = data.submissions.map((s) =>
    toSubmissionView(s, teamRows, data.feedbacks, data.votes)
  );

  const teamsView = teamRows.map((t) => {
    const mine = data.submissions.filter((s) => s.teamId === t.id);
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      members: t.members,
      submissionCount: mine.filter((s) => s.status === 'submitted').length,
      lastActivity: mine
        .map((s) => s.updatedAt.toISOString())
        .sort()
        .at(-1) ?? null
    };
  });

  const activeMissionTeamStatus = activeMissionId
    ? teamRows.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        color: t.color,
        status: data.submissions.find(
          (s) => s.teamId === t.id && s.missionId === activeMissionId
        )?.status ?? 'none'
      }))
    : [];

  return {
    session: {
      id: session.id,
      title: session.title,
      joinCode: session.joinCode,
      status: session.status,
      createdAt: session.createdAt.toISOString()
    },
    screen: {
      mode: screen.mode,
      activeStageId,
      activeMissionId,
      reviewSubmissionId: screen.reviewSubmissionId,
      reviewIndex: screen.reviewIndex,
      slideIndex: screen.slideIndex,
      revealTeams: screen.revealTeams,
      timer: timerView(screen)
    },
    stages: stageRows.map((st) => ({
      id: st.id,
      seq: st.seq,
      title: st.title,
      goal: st.goal,
      state: st.state,
      timeLimitSec: st.timeLimitSec,
      missions: data.missions
        .filter((m) => m.stageId === st.id)
        .sort((a, b) => a.seq - b.seq)
        .map((m) => ({
          ...toMissionView(m),
          submittedCount: data.submissions.filter(
            (s) => s.missionId === m.id && s.status === 'submitted'
          ).length
        })),
      slides: data.slides
        .filter((s) => s.stageId === st.id)
        .sort((a, b) => a.seq - b.seq)
        .map(toSlideView)
    })),
    activeStage,
    teams: teamsView,
    activeMissionTeamStatus,
    submissions: submissionsView,
    announcements: data.announcements.map(announcementView),
    questions: data.questions.map((q) => ({
      id: q.id,
      teamId: q.teamId,
      teamName: teamRows.find((t) => t.id === q.teamId)?.name ?? null,
      body: q.body,
      answer: q.answer,
      status: q.status,
      createdAt: q.createdAt.toISOString()
    })),
    stats: {
      teamCount: teamRows.length,
      submittedNow: activeMissionTeamStatus.filter((t) => t.status === 'submitted').length,
      totalSubmitted: data.submissions.filter((s) => s.status === 'submitted').length
    }
  };
}




