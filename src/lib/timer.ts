import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { screenStates, type ScreenStateRow } from '../db/schema.js';
import { broadcast } from './realtime.js';

export type TimerView = {
  running: boolean;
  endsAt: string | null;
  remainingSec: number | null;
};

type TimerRow = Pick<ScreenStateRow, 'timerRunning' | 'timerEndsAt' | 'timerRemainingSec'>;

export function timerView(row: TimerRow | null | undefined): TimerView {
  if (!row) return { running: false, endsAt: null, remainingSec: null };
  if (row.timerRunning && row.timerEndsAt) {
    const remainingSec = Math.max(
      0,
      Math.round((row.timerEndsAt.getTime() - Date.now()) / 1000)
    );
    return { running: true, endsAt: row.timerEndsAt.toISOString(), remainingSec };
  }
  if (row.timerRemainingSec != null) {
    return { running: false, endsAt: null, remainingSec: row.timerRemainingSec };
  }
  return { running: false, endsAt: null, remainingSec: null };
}

/** 만료 안내를 한 번만 보내기 위한 메모리 플래그 */
const announcedEnd = new Set<string>();

export function resetTimerFlag(sessionId: string): void {
  announcedEnd.delete(sessionId);
}

export function startTimerLoop(): NodeJS.Timeout {
  const tick = async (): Promise<void> => {
    try {
      const rows = await db
        .select()
        .from(screenStates)
        .where(eq(screenStates.timerRunning, true));

      for (const row of rows) {
        const view = timerView(row);
        broadcast(row.sessionId, 'timer', view);
        if ((view.remainingSec ?? 1) <= 0) {
          if (!announcedEnd.has(row.sessionId)) {
            announcedEnd.add(row.sessionId);
            broadcast(row.sessionId, 'timer:end', view);
          }
        } else {
          announcedEnd.delete(row.sessionId);
        }
      }
    } catch (err) {
      console.error('[timer] tick failed', err);
    }
  };

  return setInterval(() => {
    void tick();
  }, 1000);
}
