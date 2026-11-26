import { io, type Socket } from 'socket.io-client';
import type { TimerView } from './types';

type Handler = () => void;

export type Realtime = {
  socket: Socket;
  onRefresh: (handler: Handler) => () => void;
  onTimer: (handler: (timer: TimerView) => void) => () => void;
  disconnect: () => void;
};

export function connectRealtime(options: { joinCode?: string; sessionId?: string }): Realtime {
  const socket = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: {
      joinCode: options.joinCode ?? '',
      sessionId: options.sessionId ?? ''
    }
  });

  const refreshHandlers = new Set<Handler>();
  const timerHandlers = new Set<(timer: TimerView) => void>();

  socket.on('invalidate', () => {
    refreshHandlers.forEach((handler) => handler());
  });
  socket.on('timer', (timer: TimerView) => {
    timerHandlers.forEach((handler) => handler(timer));
  });

  return {
    socket,
    onRefresh(handler) {
      refreshHandlers.add(handler);
      return () => refreshHandlers.delete(handler);
    },
    onTimer(handler) {
      timerHandlers.add(handler);
      return () => timerHandlers.delete(handler);
    },
    disconnect() {
      socket.disconnect();
    }
  };
}
