import { useEffect, useState } from 'react';
import type { TimerView } from '../types';
import { formatClock } from '../theme';

type Size = 'sm' | 'md' | 'xl';

const sizeClass: Record<Size, string> = {
  sm: 'text-sm font-semibold tabular-nums',
  md: 'text-lg font-bold tabular-nums',
  xl: 'text-[5.5rem] leading-none font-black tabular-nums'
};

export default function Countdown({
  timer,
  size = 'md',
  className = ''
}: {
  timer: TimerView;
  size?: Size;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  if (!timer.running && timer.remainingSec === null) return null;

  const seconds =
    timer.running && timer.endsAt
      ? Math.max(0, Math.round((new Date(timer.endsAt).getTime() - now) / 1000))
      : (timer.remainingSec ?? 0);

  const danger = seconds <= 60;
  const warn = seconds <= 180 && !danger;

  return (
    <span
      className={`${sizeClass[size]} ${
        danger ? '!text-rose-500' : warn ? '!text-amber-400' : ''
      } ${className}`}
    >
      {formatClock(seconds)}
    </span>
  );
}
