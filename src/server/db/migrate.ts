import { pool } from './pool.js';

/**
 * Idempotent schema setup. Safe to run on every boot.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  username     TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  -- 'vi' | 'zh' : the language this user speaks/hears
  language     TEXT NOT NULL DEFAULT 'vi',
  -- 'owner' | 'user'
  role         TEXT NOT NULL DEFAULT 'user',
  -- 'pending' | 'approved' | 'locked'
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ
);

-- Call history / "frequent contacts" source data.
CREATE TABLE IF NOT EXISTS call_log (
  id          BIGSERIAL PRIMARY KEY,
  caller_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  callee_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'completed' -- completed | missed | rejected
);

CREATE INDEX IF NOT EXISTS idx_call_log_caller ON call_log(caller_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_log_callee ON call_log(callee_id, started_at DESC);
`;

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA);
}

// Allow running directly: `npm run migrate`
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      console.log('[migrate] schema is up to date');
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}
