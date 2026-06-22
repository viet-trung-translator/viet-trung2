import { Language } from '../auth/types.js';

/** A user as advertised in presence / call signaling. */
export interface PeerInfo {
  id: number;
  username: string;
  language: Language;
}

// ---- Client -> Server (JSON text frames) ----
export type ClientMessage =
  | { t: 'ping' }
  | { t: 'call.invite'; to: number }
  | { t: 'call.accept'; callId: string }
  | { t: 'call.reject'; callId: string }
  | { t: 'call.hangup'; callId: string }
  | { t: 'translate.start'; mode: 'solo' }
  | { t: 'translate.stop' };
// NOTE: binary frames from client = mic PCM16 mono @16kHz for the active session.

// ---- Server -> Client (JSON text frames) ----
export type ServerMessage =
  | { t: 'pong' }
  | { t: 'ready'; self: PeerInfo; online: PeerInfo[] }
  | { t: 'presence'; online: PeerInfo[] }
  | { t: 'call.incoming'; callId: string; from: PeerInfo }
  | { t: 'call.ringing'; callId: string; to: PeerInfo }
  | { t: 'call.accepted'; callId: string; peer: PeerInfo }
  | { t: 'call.rejected'; callId: string }
  | { t: 'call.ended'; callId: string; reason: string }
  | { t: 'call.failed'; reason: string }
  | { t: 'session.started'; mode: 'solo' | 'call' }
  | { t: 'session.stopped' }
  | { t: 'transcript.source'; text: string; final: boolean }
  | { t: 'transcript.translation'; text: string; final: boolean }
  | { t: 'error'; message: string };
// NOTE: binary frames to client = translated playback PCM16 mono @24kHz.

export const AUDIO_INPUT_SAMPLE_RATE = 16000;
export const AUDIO_OUTPUT_SAMPLE_RATE = 24000;
