export type Language = 'vi' | 'zh';
export type Role = 'owner' | 'user';
export type UserStatus = 'pending' | 'approved' | 'locked';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  language: Language;
  role: Role;
  status: UserStatus;
  created_at: string;
  last_seen_at: string | null;
}

/** Safe user shape returned to clients (no password hash). */
export interface PublicUser {
  id: number;
  username: string;
  language: Language;
  role: Role;
  status: UserStatus;
  createdAt: string;
  lastSeenAt: string | null;
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    username: u.username,
    language: u.language,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
    lastSeenAt: u.last_seen_at,
  };
}
