import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { RealtimeClient, ConnStatus } from './realtime';
import { AudioEngine } from './audio';
import { getToken } from './api';
import { PeerInfo, ServerMessage } from './types';
import { useAuth } from './auth';

export type CallState =
  | { kind: 'idle' }
  | { kind: 'outgoing'; callId: string; peer: PeerInfo }
  | { kind: 'incoming'; callId: string; from: PeerInfo }
  | { kind: 'active'; callId: string; peer: PeerInfo };

export interface Transcripts {
  source: string;
  translation: string;
}

interface RealtimeCtx {
  status: ConnStatus;
  online: PeerInfo[];
  call: CallState;
  soloActive: boolean;
  transcripts: Transcripts;
  notice: string | null;
  invite: (userId: number) => void;
  accept: () => void;
  reject: () => void;
  hangup: () => void;
  startSolo: () => Promise<void>;
  stopSolo: () => void;
  clearNotice: () => void;
}

const Ctx = createContext<RealtimeCtx | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const clientRef = useRef<RealtimeClient | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);

  const [status, setStatus] = useState<ConnStatus>('closed');
  const [online, setOnline] = useState<PeerInfo[]>([]);
  const [call, setCall] = useState<CallState>({ kind: 'idle' });
  const [soloActive, setSoloActive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // transcript buffers
  const srcLines = useRef<string[]>([]);
  const srcInterim = useRef('');
  const trLines = useRef<string[]>([]);
  const trInterim = useRef('');
  const [transcripts, setTranscripts] = useState<Transcripts>({ source: '', translation: '' });

  const resetTranscripts = useCallback(() => {
    srcLines.current = [];
    srcInterim.current = '';
    trLines.current = [];
    trInterim.current = '';
    setTranscripts({ source: '', translation: '' });
  }, []);

  const renderTranscripts = useCallback(() => {
    setTranscripts({
      source: [...srcLines.current, srcInterim.current].filter(Boolean).join('\n'),
      translation: [...trLines.current, trInterim.current].filter(Boolean).join('\n'),
    });
  }, []);

  const stopAudio = useCallback(() => {
    audioRef.current?.stop();
    audioRef.current = null;
  }, []);

  // Create + unlock the AudioContext synchronously inside a user gesture
  // (Call / Accept / Mic tap). iOS requires this or playback stays muted.
  const primeAudio = useCallback(() => {
    if (!audioRef.current) {
      const engine = new AudioEngine();
      engine.setHalfDuplex(true);
      audioRef.current = engine;
    }
    audioRef.current.prime();
  }, []);

  const startAudioCapture = useCallback(async () => {
    if (!audioRef.current) {
      const engine = new AudioEngine();
      engine.setHalfDuplex(true);
      audioRef.current = engine;
    }
    if (audioRef.current.started) return;
    await audioRef.current.start((pcm) => clientRef.current?.sendAudio(pcm));
  }, []);

  // Establish the websocket once we have an authenticated user.
  useEffect(() => {
    const token = getToken();
    if (!user || !token) return;

    const client = new RealtimeClient(token);
    clientRef.current = client;

    client.onStatus = setStatus;
    client.onAudio = (pcm) => audioRef.current?.playPcm(pcm);
    client.onMessage = (msg: ServerMessage) => {
      switch (msg.t) {
        case 'ready':
          setOnline(msg.online.filter((p) => p.id !== user.id));
          break;
        case 'presence':
          setOnline(msg.online.filter((p) => p.id !== user.id));
          break;
        case 'call.ringing':
          setCall({ kind: 'outgoing', callId: msg.callId, peer: msg.to });
          break;
        case 'call.incoming':
          setCall({ kind: 'incoming', callId: msg.callId, from: msg.from });
          break;
        case 'call.accepted':
          resetTranscripts();
          setCall({ kind: 'active', callId: msg.callId, peer: msg.peer });
          break;
        case 'call.rejected':
          setNotice('rejected');
          setCall({ kind: 'idle' });
          break;
        case 'call.ended':
          setCall({ kind: 'idle' });
          stopAudio();
          break;
        case 'call.failed':
          setNotice(msg.reason);
          setCall({ kind: 'idle' });
          break;
        case 'session.started':
          void startAudioCapture();
          break;
        case 'session.stopped':
          stopAudio();
          break;
        case 'transcript.source':
          if (msg.final) {
            if (msg.text.trim()) srcLines.current.push(msg.text.trim());
            srcInterim.current = '';
          } else {
            srcInterim.current = msg.text;
          }
          renderTranscripts();
          break;
        case 'transcript.translation':
          if (msg.final) {
            if (msg.text.trim()) trLines.current.push(msg.text.trim());
            trInterim.current = '';
          } else {
            trInterim.current = msg.text;
          }
          renderTranscripts();
          break;
        case 'error':
          setNotice(msg.message);
          break;
      }
    };

    client.connect();
    return () => {
      client.close();
      clientRef.current = null;
      stopAudio();
    };
  }, [user, resetTranscripts, renderTranscripts, startAudioCapture, stopAudio]);

  const invite = useCallback(
    (userId: number) => {
      primeAudio(); // unlock audio within this tap (caller's session starts later)
      clientRef.current?.send({ t: 'call.invite', to: userId });
    },
    [primeAudio],
  );

  const accept = useCallback(() => {
    primeAudio(); // unlock audio within this tap
    setCall((c) => {
      if (c.kind === 'incoming') clientRef.current?.send({ t: 'call.accept', callId: c.callId });
      return c;
    });
  }, [primeAudio]);

  const reject = useCallback(() => {
    setCall((c) => {
      if (c.kind === 'incoming') clientRef.current?.send({ t: 'call.reject', callId: c.callId });
      return { kind: 'idle' };
    });
  }, []);

  const hangup = useCallback(() => {
    setCall((c) => {
      if (c.kind !== 'idle') {
        const callId = 'callId' in c ? c.callId : '';
        if (callId) clientRef.current?.send({ t: 'call.hangup', callId });
      }
      return { kind: 'idle' };
    });
    stopAudio();
  }, [stopAudio]);

  const startSolo = useCallback(async () => {
    primeAudio(); // unlock audio synchronously within the tap (iOS)
    resetTranscripts();
    setSoloActive(true);
    await startAudioCapture();
    clientRef.current?.send({ t: 'translate.start', mode: 'solo' });
  }, [resetTranscripts, startAudioCapture, primeAudio]);

  const stopSolo = useCallback(() => {
    setSoloActive(false);
    clientRef.current?.send({ t: 'translate.stop' });
    stopAudio();
  }, [stopAudio]);

  return (
    <Ctx.Provider
      value={{
        status,
        online,
        call,
        soloActive,
        transcripts,
        notice,
        invite,
        accept,
        reject,
        hangup,
        startSolo,
        stopSolo,
        clearNotice: () => setNotice(null),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useRealtime(): RealtimeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useRealtime outside provider');
  return c;
}
