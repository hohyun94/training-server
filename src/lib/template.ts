import { eq } from 'drizzle-orm';
import type { SessionTemplate } from '../content/default-template.js';
import { db } from '../db/index.js';
import { missions, screenStates, slides, stages } from '../db/schema.js';

/**
 * 세션의 단계/미션/슬라이드를 템플릿으로 통째로 교체한다.
 * 기존 단계에 딸린 제출물은 cascade 로 함께 삭제된다.
 */
export async function applyTemplate(sessionId: string, template: SessionTemplate): Promise<void> {
  await db.delete(stages).where(eq(stages.sessionId, sessionId));
  await db.insert(screenStates).values({ sessionId }).onConflictDoNothing();
  await db
    .update(screenStates)
    .set({
      mode: 'idle',
      activeStageId: null,
      activeMissionId: null,
      reviewSubmissionId: null,
      reviewIndex: 0,
      timerRunning: false,
      timerEndsAt: null,
      timerRemainingSec: null,
      updatedAt: new Date()
    })
    .where(eq(screenStates.sessionId, sessionId));

  let firstStageId: string | null = null;

  for (let i = 0; i < template.stages.length; i += 1) {
    const stageDef = template.stages[i];
    const [stage] = await db
      .insert(stages)
      .values({
        sessionId,
        seq: i + 1,
        title: stageDef.title,
        goal: stageDef.goal ?? '',
        timeLimitSec: stageDef.timeLimitSec ?? 600
      })
      .returning();
    if (!firstStageId) firstStageId = stage.id;

    const missionDefs = stageDef.missions ?? [];
    if (missionDefs.length) {
      await db.insert(missions).values(
        missionDefs.map((m, index) => ({
          stageId: stage.id,
          seq: index + 1,
          title: m.title ?? '',
          prompt: m.prompt,
          inputType: m.inputType ?? 'longtext',
          options: m.options ?? [],
          maxLen: m.maxLen ?? 2000,
          allowEdit: m.allowEdit ?? true,
          required: m.required ?? true
        }))
      );
    }

    const slideDefs = stageDef.slides ?? [];
    if (slideDefs.length) {
      await db.insert(slides).values(
        slideDefs.map((s, index) => ({
          stageId: stage.id,
          seq: index + 1,
          type: s.type ?? 'markdown',
          content: s.content,
          notes: s.notes ?? ''
        }))
      );
    }
  }

  await db
    .update(screenStates)
    .set({ activeStageId: firstStageId, updatedAt: new Date() })
    .where(eq(screenStates.sessionId, sessionId));
}
