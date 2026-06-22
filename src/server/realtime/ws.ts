import { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyToken } from '../auth/jwt.js';
import { getUserById } from '../auth/service.js';
import { hub } from './hub.js';
import { ClientMessage } from './protocol.js';

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, async (socket: WebSocket, req) => {
    // Auth via ?token= query param (browsers can't set headers on WS).
    const url = new URL(req.url ?? '', 'http://localhost');
    const token = url.searchParams.get('token');
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      socket.close(4001, 'unauthorized');
      return;
    }

    // Confirm the account is still approved (not locked/deleted since token issue).
    const user = await getUserById(payload.uid);
    if (!user || user.status !== 'approved') {
      socket.close(4003, 'not_approved');
      return;
    }

    const conn = hub.add(
      { id: user.id, username: user.username, language: user.language },
      socket,
    );

    socket.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        hub.feedAudio(conn, data);
        return;
      }
      let msg: ClientMessage;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      handleControl(conn, msg);
    });

    socket.on('close', () => hub.remove(conn));
    socket.on('error', () => hub.remove(conn));
  });
}

function handleControl(conn: Parameters<typeof hub.feedAudio>[0], msg: ClientMessage): void {
  switch (msg.t) {
    case 'ping':
      conn.send({ t: 'pong' });
      break;
    case 'call.invite':
      hub.invite(conn, msg.to);
      break;
    case 'call.accept':
      void hub.accept(conn, msg.callId);
      break;
    case 'call.reject':
      hub.reject(conn, msg.callId);
      break;
    case 'call.hangup':
      hub.hangup(conn, msg.callId);
      break;
    case 'translate.start':
      hub.startSolo(conn);
      break;
    case 'translate.stop':
      hub.stopSolo(conn);
      break;
    default:
      // Unknown message — ignore.
      break;
  }
}
