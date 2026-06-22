export type Language = 'vi' | 'zh';
export type Role = 'owner' | 'user';
export type UserStatus = 'pending' | 'approved' | 'locked';

export interface PublicUser {
  id: number;
  username: string;
  language: Language;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastSeenAt: string | null;
}

export interface PeerInfo {
  id: number;
  username: string;
  language: Language;
}

export interface ContactEntry {
  id: number;
  username: string;
  language: Language;
  callCount: number;
  lastCallAt: string | null;
}

// Server -> Client messages (mirror of server/realtime/protocol.ts)
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

// Client -> Server messages
export type ClientMessage =
  | { t: 'ping' }
  | { t: 'call.invite'; to: number }
  | { t: 'call.accept'; callId: string }
  | { t: 'call.reject'; callId: string }
  | { t: 'call.hangup'; callId: string }
  | { t: 'translate.start'; mode: 'solo' }
  | { t: 'translate.stop' };

export const AUDIO_INPUT_SAMPLE_RATE = 16000;
export const AUDIO_OUTPUT_SAMPLE_RATE = 24000;
