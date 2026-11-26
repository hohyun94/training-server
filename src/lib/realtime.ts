import type { Server as HttpServer } from 'node:http';
import { eq } from 'drizzle-orm';
import { Server } from 'socket.io';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';
import {
  INSTRUCTOR_COOKIE,
  TEAM_COOKIE,
  verifyToken,
  type InstructorToken,
  type TeamToken
} from './auth.js';

let io: Server | null = null;

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      out[key] = part.slice(idx + 1).trim();
    }
  }
  return out;
}

export function initRealtime(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: true, credentials: true } });

  io.on('connection', (socket) => {
    void (async () => {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const instructor = verifyToken<InstructorToken>(cookies[INSTRUCTOR_COOKIE]);
      const team = verifyToken<TeamToken>(cookies[TEAM_COOKIE]);

      if (instructor?.role === 'instructor') {
        socket.join('admin');
        const adminSession = socket.handshake.auth?.sessionId;
        if (typeof adminSession === 'string' && adminSession) {
          socket.join(`session:${adminSession}`);
        }
      }

      if (team?.role === 'team') {
        socket.join(`session:${team.sessionId}`);
        socket.join(`team:${team.teamId}`);
      }

      const joinCode = socket.handshake.auth?.joinCode;
      if (typeof joinCode === 'string' && joinCode.length >= 4) {
        const [row] = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.joinCode, joinCode.trim().toUpperCase()));
        if (row) {
          socket.join(`session:${row.id}`);
          socket.join(`screen:${row.id}`);
        }
      }

      socket.emit('ready', { at: Date.now() });
    })().catch((err) => console.error('[socket] auth error', err));
  });

  return io;
}

export function broadcast(sessionId: string, event: string, payload?: unknown): void {
  io?.to(`session:${sessionId}`).emit(event, payload);
}

export function notifySession(
  sessionId: string,
  scope: 'all' | 'screen' | 'play' | 'admin' = 'all'
): void {
  broadcast(sessionId, 'invalidate', { sessionId, scope, at: Date.now() });
}

export function socketServer(): Server | null {
  return io;
}
