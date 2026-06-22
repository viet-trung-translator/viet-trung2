import type { WebSocket } from 'ws';
import { PeerInfo, ServerMessage } from './protocol.js';
import { createTranslationSession, TranslationSession } from './gemini.js';
import { logCallEnd, logCallStart } from './contacts.js';
import { Language } from '../auth/types.js';
import { randomUUID } from 'node:crypto';

export class Conn {
  session: TranslationSession | null = null;
  callId: string | null = null;

  constructor(
    public readonly info: PeerInfo,
    public readonly ws: WebSocket,
  ) {}

  get userId(): number {
    return this.info.id;
  }

  send(msg: ServerMessage): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendAudio(pcm: Buffer): void {
    if (this.ws.readyState === this.ws.OPEN) {
      this.ws.send(pcm, { binary: true });
    }
  }

  get busy(): boolean {
    return this.callId !== null;
  }

  stopSession(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }
}

interface Call {
  id: string;
  caller: Conn;
  callee: Conn;
  logId: number | null;
  state: 'ringing' | 'active';
}

export class Hub {
  private conns = new Map<number, Conn>();
  private calls = new Map<string, Call>();

  // --- connection lifecycle ---

  add(info: PeerInfo, ws: WebSocket): Conn {
    // One active connection per user — replace any existing one.
    const existing = this.conns.get(info.id);
    if (existing) {
      try {
        existing.ws.close(4000, 'replaced by new connection');
      } catch {
        /* ignore */
      }
      this.cleanup(existing, 'replaced');
    }
    const conn = new Conn(info, ws);
    this.conns.set(info.id, conn);
    conn.send({ t: 'ready', self: info, online: this.onlineList() });
    this.broadcastPresence();
    return conn;
  }

  remove(conn: Conn): void {
    if (this.conns.get(conn.userId) === conn) {
      this.conns.delete(conn.userId);
    }
    this.cleanup(conn, 'disconnected');
    this.broadcastPresence();
  }

  private cleanup(conn: Conn, reason: string): void {
    conn.stopSession();
    if (conn.callId) {
      this.endCall(conn.callId, reason);
    }
  }

  // --- presence ---

  private onlineList(): PeerInfo[] {
    return [...this.conns.values()].map((c) => c.info);
  }

  private broadcastPresence(): void {
    const online = this.onlineList();
    for (const c of this.conns.values()) {
      c.send({ t: 'presence', online });
    }
  }

  // --- call signaling ---

  invite(caller: Conn, toUserId: number): void {
    const callee = this.conns.get(toUserId);
    if (!callee) {
      caller.send({ t: 'call.failed', reason: 'offline' });
      return;
    }
    if (callee.busy || caller.busy) {
      caller.send({ t: 'call.failed', reason: 'busy' });
      return;
    }
    const id = randomUUID();
    const call: Call = { id, caller, callee, logId: null, state: 'ringing' };
    this.calls.set(id, call);
    caller.callId = id;
    callee.callId = id;
    callee.send({ t: 'call.incoming', callId: id, from: caller.info });
    caller.send({ t: 'call.ringing', callId: id, to: callee.info });
  }

  reject(conn: Conn, callId: string): void {
    const call = this.calls.get(callId);
    if (!call) return;
    call.caller.send({ t: 'call.rejected', callId });
    this.disposeCall(call, 'rejected');
  }

  hangup(conn: Conn, callId: string): void {
    this.endCall(callId, 'hangup');
  }

  async accept(callee: Conn, callId: string): Promise<void> {
    const call = this.calls.get(callId);
    if (!call || call.callee !== callee || call.state !== 'ringing') return;
    call.state = 'active';

    try {
      call.logId = await logCallStart(call.caller.userId, call.callee.userId);
    } catch (err) {
      console.error('[hub] logCallStart failed', err);
    }

    // Each participant gets their own translation session.
    // Outputs (translated audio + translated text) are routed to the *peer*;
    // the source transcript is shown to the speaker.
    this.startCallSession(call.caller, call.callee);
    this.startCallSession(call.callee, call.caller);

    call.caller.send({ t: 'call.accepted', callId, peer: call.callee.info });
    call.callee.send({ t: 'call.accepted', callId, peer: call.caller.info });
    call.caller.send({ t: 'session.started', mode: 'call' });
    call.callee.send({ t: 'session.started', mode: 'call' });
  }

  private startCallSession(speaker: Conn, listener: Conn): void {
    speaker.stopSession();
    speaker.session = createTranslationSession(
      { source: speaker.info.language, target: listener.info.language, mode: 'call' },
      {
        onSourceText: (text, final) => speaker.send({ t: 'transcript.source', text, final }),
        onTranslatedText: (text, final) =>
          listener.send({ t: 'transcript.translation', text, final }),
        onTranslatedAudio: (pcm) => listener.sendAudio(pcm),
        onError: (err) => speaker.send({ t: 'error', message: `translate: ${err.message}` }),
      },
    );
  }

  private endCall(callId: string, reason: string): void {
    const call = this.calls.get(callId);
    if (!call) return;
    call.caller.send({ t: 'call.ended', callId, reason });
    call.callee.send({ t: 'call.ended', callId, reason });
    this.disposeCall(call, reason);
  }

  private disposeCall(call: Call, reason: string): void {
    this.calls.delete(call.id);
    for (const c of [call.caller, call.callee]) {
      if (c.callId === call.id) c.callId = null;
      c.stopSession();
      c.send({ t: 'session.stopped' });
    }
    if (call.logId !== null) {
      logCallEnd(call.logId, call.state === 'active' ? 'completed' : reason).catch(() => {});
    }
  }

  // --- single-device (solo) translation ---

  startSolo(conn: Conn): void {
    if (conn.busy) {
      conn.send({ t: 'error', message: 'cannot start solo while in a call' });
      return;
    }
    conn.stopSession();
    conn.session = createTranslationSession(
      { source: 'auto', target: 'auto', mode: 'solo' },
      {
        onSourceText: (text, final) => conn.send({ t: 'transcript.source', text, final }),
        onTranslatedText: (text, final) => conn.send({ t: 'transcript.translation', text, final }),
        onTranslatedAudio: (pcm) => conn.sendAudio(pcm),
        onError: (err) => conn.send({ t: 'error', message: `translate: ${err.message}` }),
      },
    );
    conn.send({ t: 'session.started', mode: 'solo' });
  }

  stopSolo(conn: Conn): void {
    conn.stopSession();
    conn.send({ t: 'session.stopped' });
  }

  // --- audio ingest ---

  feedAudio(conn: Conn, pcm: Buffer): void {
    conn.session?.sendAudio(pcm);
  }
}

export const hub = new Hub();
