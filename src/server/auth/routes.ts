import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AuthError,
  deleteUser,
  getUserById,
  listUsers,
  loginUser,
  registerUser,
  setUserStatus,
} from './service.js';
import { signToken, verifyToken, TokenPayload } from './jwt.js';
import { Language, toPublicUser } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: TokenPayload;
  }
}

function getBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice('Bearer '.length).trim();
}

/** Require a valid token; attaches req.auth. */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  const token = getBearer(req);
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    reply.code(401).send({ error: 'unauthorized' });
    return false;
  }
  req.auth = payload;
  return true;
}

async function requireOwner(req: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!(await requireAuth(req, reply))) return false;
  if (req.auth!.role !== 'owner') {
    reply.code(403).send({ error: 'forbidden' });
    return false;
  }
  return true;
}

function normalizeLanguage(v: unknown): Language {
  return v === 'zh' ? 'zh' : 'vi';
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/register', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const user = await registerUser(
        String(body.username ?? ''),
        String(body.password ?? ''),
        normalizeLanguage(body.language),
      );
      // Auto-login only if approved (i.e. the first/owner account).
      if (user.status === 'approved') {
        const token = signToken({
          uid: user.id,
          username: user.username,
          role: user.role,
          language: user.language,
        });
        return reply.send({ token, user: toPublicUser(user) });
      }
      return reply.send({ pending: true, user: toPublicUser(user) });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
      }
      req.log.error(err);
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const user = await loginUser(String(body.username ?? ''), String(body.password ?? ''));
      const token = signToken({
        uid: user.id,
        username: user.username,
        role: user.role,
        language: user.language,
      });
      return reply.send({ token, user: toPublicUser(user) });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
      }
      req.log.error(err);
      return reply.code(500).send({ error: 'server_error' });
    }
  });

  app.get('/api/me', async (req, reply) => {
    if (!(await requireAuth(req, reply))) return;
    const user = await getUserById(req.auth!.uid);
    if (!user) return reply.code(404).send({ error: 'not_found' });
    if (user.status !== 'approved') {
      return reply.code(403).send({ error: 'not_approved' });
    }
    return reply.send({ user: toPublicUser(user) });
  });

  // --- Admin (owner only) ---
  app.get('/api/admin/users', async (req, reply) => {
    if (!(await requireOwner(req, reply))) return;
    const users = await listUsers();
    return reply.send({ users: users.map(toPublicUser) });
  });

  app.post('/api/admin/users/:id/status', async (req, reply) => {
    if (!(await requireOwner(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    const status = String((req.body as { status?: string })?.status ?? '');
    if (!['pending', 'approved', 'locked'].includes(status)) {
      return reply.code(400).send({ error: 'invalid_status' });
    }
    if (id === req.auth!.uid) {
      return reply.code(400).send({ error: 'cannot_modify_self' });
    }
    await setUserStatus(id, status as 'pending' | 'approved' | 'locked');
    return reply.send({ ok: true });
  });

  app.delete('/api/admin/users/:id', async (req, reply) => {
    if (!(await requireOwner(req, reply))) return;
    const id = Number((req.params as { id: string }).id);
    if (id === req.auth!.uid) {
      return reply.code(400).send({ error: 'cannot_delete_self' });
    }
    await deleteUser(id);
    return reply.send({ ok: true });
  });
}
