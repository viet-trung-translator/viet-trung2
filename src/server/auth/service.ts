import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { Language, UserRow } from './types.js';

export class AuthError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
  }
}

function validateCredentials(username: string, password: string) {
  if (!username || username.trim().length < 3) {
    throw new AuthError('username_too_short', 'Username must be at least 3 characters');
  }
  if (!password || password.length < 6) {
    throw new AuthError('password_too_short', 'Password must be at least 6 characters');
  }
}

/**
 * Register a new user. The very first registered account becomes the owner
 * (admin) and is auto-approved. Every subsequent account is created as
 * `pending` and must be approved by the owner before it can sign in.
 */
export async function registerUser(
  username: string,
  password: string,
  language: Language,
): Promise<UserRow> {
  validateCredentials(username, password);
  const normalized = username.trim();

  const existing = await query<UserRow>('SELECT id FROM users WHERE username = $1', [normalized]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new AuthError('username_taken', 'Username already exists', 409);
  }

  const countRes = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  const isFirst = Number(countRes.rows[0]?.count ?? '0') === 0;

  const passwordHash = await bcrypt.hash(password, 10);
  const role = isFirst ? 'owner' : 'user';
  const status = isFirst ? 'approved' : 'pending';

  const inserted = await query<UserRow>(
    `INSERT INTO users (username, password_hash, language, role, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [normalized, passwordHash, language, role, status],
  );
  return inserted.rows[0];
}

export async function loginUser(username: string, password: string): Promise<UserRow> {
  const normalized = username.trim();
  const res = await query<UserRow>('SELECT * FROM users WHERE username = $1', [normalized]);
  const user = res.rows[0];
  if (!user) {
    throw new AuthError('invalid_credentials', 'Wrong username or password', 401);
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new AuthError('invalid_credentials', 'Wrong username or password', 401);
  }
  if (user.status === 'pending') {
    throw new AuthError('pending_approval', 'Account is waiting for owner approval', 403);
  }
  if (user.status === 'locked') {
    throw new AuthError('account_locked', 'Account has been locked', 403);
  }
  return user;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const res = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

// --- Admin operations (owner only) ---

export async function listUsers(): Promise<UserRow[]> {
  const res = await query<UserRow>('SELECT * FROM users ORDER BY created_at ASC');
  return res.rows;
}

export async function setUserStatus(
  targetId: number,
  status: 'pending' | 'approved' | 'locked',
): Promise<void> {
  await query('UPDATE users SET status = $1 WHERE id = $2', [status, targetId]);
}

export async function deleteUser(targetId: number): Promise<void> {
  await query('DELETE FROM users WHERE id = $1', [targetId]);
}
