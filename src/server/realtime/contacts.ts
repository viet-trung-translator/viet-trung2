import { query } from '../db/pool.js';
import { Language } from '../auth/types.js';

export interface ContactEntry {
  id: number;
  username: string;
  language: Language;
  callCount: number;
  lastCallAt: string | null;
}

/**
 * "Frequent contacts": people this user has called most + most recently,
 * regardless of whether they are currently online. Combines both call
 * directions (caller or callee).
 */
export async function frequentContacts(userId: number, limit = 20): Promise<ContactEntry[]> {
  const res = await query<{
    id: number;
    username: string;
    language: Language;
    call_count: string;
    last_call_at: string | null;
  }>(
    `
    WITH peers AS (
      SELECT callee_id AS peer_id, started_at FROM call_log WHERE caller_id = $1
      UNION ALL
      SELECT caller_id AS peer_id, started_at FROM call_log WHERE callee_id = $1
    )
    SELECT u.id, u.username, u.language,
           COUNT(*)::text AS call_count,
           MAX(p.started_at) AS last_call_at
    FROM peers p
    JOIN users u ON u.id = p.peer_id
    WHERE u.status = 'approved'
    GROUP BY u.id, u.username, u.language
    ORDER BY MAX(p.started_at) DESC, COUNT(*) DESC
    LIMIT $2
    `,
    [userId, limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    username: r.username,
    language: r.language,
    callCount: Number(r.call_count),
    lastCallAt: r.last_call_at,
  }));
}

export async function searchUsers(
  selfId: number,
  q: string,
  limit = 20,
): Promise<{ id: number; username: string; language: Language }[]> {
  const res = await query<{ id: number; username: string; language: Language }>(
    `SELECT id, username, language FROM users
     WHERE status = 'approved' AND id <> $1 AND username ILIKE $2
     ORDER BY username ASC LIMIT $3`,
    [selfId, `%${q}%`, limit],
  );
  return res.rows;
}

export async function logCallStart(callerId: number, calleeId: number): Promise<number> {
  const res = await query<{ id: number }>(
    `INSERT INTO call_log (caller_id, callee_id, status) VALUES ($1, $2, 'completed') RETURNING id`,
    [callerId, calleeId],
  );
  return res.rows[0].id;
}

export async function logCallEnd(callLogId: number, status: string): Promise<void> {
  await query(`UPDATE call_log SET ended_at = now(), status = $2 WHERE id = $1`, [callLogId, status]);
}
