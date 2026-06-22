import { ClientMessage, ServerMessage } from './types';

export type ConnStatus = 'connecting' | 'open' | 'closed';

export class RealtimeClient {
  private ws: WebSocket | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoff = 1000;
  private closedByUser = false;

  onMessage: (msg: ServerMessage) => void = () => {};
  onAudio: (pcm: ArrayBuffer) => void = () => {};
  onStatus: (status: ConnStatus) => void = () => {};

  constructor(private token: string) {}

  private url(): string {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws?token=${encodeURIComponent(this.token)}`;
  }

  connect(): void {
    this.closedByUser = false;
    this.onStatus('connecting');
    const ws = new WebSocket(this.url());
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1000;
      this.onStatus('open');
      this.startHeartbeat();
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        try {
          this.onMessage(JSON.parse(ev.data));
        } catch {
          /* ignore */
        }
      } else if (ev.data instanceof ArrayBuffer) {
        this.onAudio(ev.data);
      }
    };
    ws.onclose = () => {
      this.stopHeartbeat();
      this.onStatus('closed');
      if (!this.closedByUser) this.scheduleReconnect();
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.backoff);
    this.backoff = Math.min(this.backoff * 1.6, 15000);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => this.send({ t: 'ping' }), 25000);
  }
  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(pcm);
    }
  }

  close(): void {
    this.closedByUser = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
  }
}
