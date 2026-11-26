import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

/** 교육 회차(세션). 한 번의 교육 = sessions 1건. */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  /** 교육생 입장 코드 (6자리) */
  joinCode: text('join_code').notNull().unique(),
  /** draft | live | closed */
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** 조(팀). 교육생은 조 단위로 미션을 수행한다. */
export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** UI 색상 키 (sky | violet | amber | emerald | rose | cyan | lime | fuchsia) */
    color: text('color').notNull().default('sky'),
    members: text('members').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('teams_session_name_unique').on(t.sessionId, t.name)]
);

/** 5단계 진행. 각 단계는 잠금/진행/리뷰/종료 상태를 가진다. */
export const stages = pgTable(
  'stages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    title: text('title').notNull(),
    goal: text('goal').notNull().default(''),
    /** 단계 기본 제한시간(초) */
    timeLimitSec: integer('time_limit_sec').notNull().default(600),
    /** locked | open | review | closed */
    state: text('state').notNull().default('locked'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('stages_session_seq_unique').on(t.sessionId, t.seq)]
);

/** 단계 안의 미션. 텍스트 입력 / 선택형 / 파일·링크 제출을 모두 지원한다. */
export const missions = pgTable(
  'missions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stageId: uuid('stage_id')
      .notNull()
      .references(() => stages.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull().default(1),
    title: text('title').notNull().default(''),
    prompt: text('prompt').notNull(),
    /** text | longtext | choice | number | url | file */
    inputType: text('input_type').notNull().default('longtext'),
    options: jsonb('options').$type<string[]>().notNull().default([]),
    maxLen: integer('max_len').notNull().default(2000),
    allowEdit: boolean('allow_edit').notNull().default(true),
    required: boolean('required').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('missions_stage_seq_unique').on(t.stageId, t.seq)]
);

/** 조별 제출물. (mission, team) 당 1건. */
export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    missionId: uuid('mission_id')
      .notNull()
      .references(() => missions.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    content: text('content').notNull().default(''),
    fileUrl: text('file_url'),
    fileName: text('file_name'),
    /** draft | submitted */
    status: text('status').notNull().default('draft'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('submissions_mission_team_unique').on(t.missionId, t.teamId)]
);

/** 단계별 강의자료(슬라이드). markdown | image | url */
export const slides = pgTable('slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull().default(1),
  type: text('type').notNull().default('markdown'),
  content: text('content').notNull().default(''),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** 메인 화면(프로젝터)이 무엇을 보여줄지에 대한 단일 진실원. */
export const screenStates = pgTable('screen_states', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  /** idle | stage_intro | mission | lecture | review | scoreboard */
  mode: text('mode').notNull().default('idle'),
  activeStageId: uuid('active_stage_id'),
  activeMissionId: uuid('active_mission_id'),
  reviewSubmissionId: uuid('review_submission_id'),
  reviewIndex: integer('review_index').notNull().default(0),
  slideIndex: integer('slide_index').notNull().default(0),
  revealTeams: boolean('reveal_teams').notNull().default(true),
  timerRunning: boolean('timer_running').notNull().default(false),
  timerEndsAt: timestamp('timer_ends_at', { withTimezone: true }),
  timerRemainingSec: integer('timer_remaining_sec'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** 강사 피드백. 교육생 화면에도 노출 가능. */
export const feedbacks = pgTable('feedbacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id')
    .notNull()
    .references(() => submissions.id, { onDelete: 'cascade' }),
  body: text('body').notNull().default(''),
  score: integer('score'),
  isStar: boolean('is_star').notNull().default(false),
  visibleToTeam: boolean('visible_to_team').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** 전체 공지(브로드캐스트). */
export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  body: text('body').notNull(),
  pinned: boolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** 교육생 → 강사 질문. */
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  body: text('body').notNull(),
  answer: text('answer').notNull().default(''),
  /** open | answered */
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/** 조별 상호 투표(선택 기능). */
export const votes = pgTable(
  'votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => submissions.id, { onDelete: 'cascade' }),
    voterTeamId: uuid('voter_team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('votes_submission_voter_unique').on(t.submissionId, t.voterTeamId)]
);

export type SessionRow = typeof sessions.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type StageRow = typeof stages.$inferSelect;
export type MissionRow = typeof missions.$inferSelect;
export type SubmissionRow = typeof submissions.$inferSelect;
export type SlideRow = typeof slides.$inferSelect;
export type ScreenStateRow = typeof screenStates.$inferSelect;
export type FeedbackRow = typeof feedbacks.$inferSelect;
export type AnnouncementRow = typeof announcements.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type VoteRow = typeof votes.$inferSelect;
