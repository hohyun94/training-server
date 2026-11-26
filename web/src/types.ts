export type StageState = 'locked' | 'open' | 'review' | 'closed';
export type ScreenMode = 'idle' | 'stage_intro' | 'mission' | 'lecture' | 'review' | 'scoreboard';
export type InputType = 'text' | 'longtext' | 'choice' | 'number' | 'url' | 'file';

export type TimerView = {
  running: boolean;
  endsAt: string | null;
  remainingSec: number | null;
};

export type SessionInfo = {
  id: string;
  title: string;
  joinCode: string;
  status: string;
};

export type Announcement = {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export type FeedbackView = {
  id: string;
  body: string;
  score: number | null;
  isStar: boolean;
  visibleToTeam: boolean;
  createdAt: string;
};

export type MissionView = {
  id: string;
  stageId: string;
  seq: number;
  title: string;
  prompt: string;
  inputType: InputType | string;
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

export type TeamStatusView = {
  id: string;
  name: string;
  color: string;
  members: string;
  submitted: boolean;
  submittedCount: number;
  missionCount: number;
};

export type StageSummary = {
  id: string;
  seq: number;
  title: string;
  goal: string;
  state: StageState;
  timeLimitSec: number;
  missionCount: number;
};

/* ---------- 프로젝터(메인 화면) ---------- */

export type ScreenBundle = {
  session: SessionInfo;
  screen: {
    mode: ScreenMode;
    activeStageId: string | null;
    activeMissionId: string | null;
    reviewSubmissionId: string | null;
    reviewIndex: number;
    slideIndex: number;
    revealTeams: boolean;
    timer: TimerView;
    updatedAt: string;
  };
  stages: StageSummary[];
  stage: (StageSummary & { missions: MissionView[]; slides: SlideView[] }) | null;
  mission: MissionView | null;
  slide: SlideView | null;
  submissions: SubmissionView[];
  teams: TeamStatusView[];
  reviewSubmission: SubmissionView | null;
  announcements: Announcement[];
  joinUrl: string;
  screenUrl: string;
  baseUrl: string;
};

/* ---------- 교육생 ---------- */

export type PlaySubmission = {
  id: string;
  content: string;
  fileUrl: string | null;
  fileName: string | null;
  status: string;
  submittedAt: string | null;
  updatedAt: string;
  feedbacks: FeedbackView[];
};

export type PlayMission = MissionView & { submission: PlaySubmission | null };

export type PlayStage = {
  id: string;
  seq: number;
  title: string;
  goal: string;
  state: StageState;
  timeLimitSec: number;
  missions: PlayMission[];
};

export type PlayBundle = {
  session: SessionInfo;
  me: { teamId: string; name: string; color: string; members: string };
  screen: {
    mode: ScreenMode;
    activeStageId: string | null;
    activeMissionId: string | null;
    timer: TimerView;
  };
  currentStage: PlayStage | null;
  stages: PlayStage[];
  announcements: Announcement[];
  myQuestions: { id: string; body: string; answer: string; status: string; createdAt: string }[];
};

/* ---------- 강사 ---------- */

export type AdminMission = MissionView & { submittedCount: number };

export type AdminStage = {
  id: string;
  seq: number;
  title: string;
  goal: string;
  state: StageState;
  timeLimitSec: number;
  missions: AdminMission[];
  slides: SlideView[];
};

export type AdminBundle = {
  session: SessionInfo & { createdAt: string };
  screen: {
    mode: ScreenMode;
    activeStageId: string | null;
    activeMissionId: string | null;
    reviewSubmissionId: string | null;
    reviewIndex: number;
    slideIndex: number;
    revealTeams: boolean;
    timer: TimerView;
  };
  stages: AdminStage[];
  activeStage: { id: string; seq: number; title: string; goal: string; state: StageState } | null;
  teams: {
    id: string;
    name: string;
    color: string;
    members: string;
    submissionCount: number;
    lastActivity: string | null;
  }[];
  activeMissionTeamStatus: {
    teamId: string;
    teamName: string;
    color: string;
    status: string;
  }[];
  submissions: SubmissionView[];
  announcements: Announcement[];
  questions: {
    id: string;
    teamId: string | null;
    teamName: string | null;
    body: string;
    answer: string;
    status: string;
    createdAt: string;
  }[];
  stats: { teamCount: number; submittedNow: number; totalSubmitted: number };
  joinUrl: string;
  screenUrl: string;
};

export type SessionListItem = {
  id: string;
  title: string;
  joinCode: string;
  status: string;
  createdAt: string;
  teamCount: number;
};

export type PublicSessionInfo = {
  session: SessionInfo;
  teams: { id: string; name: string; color: string; members: string }[];
};
