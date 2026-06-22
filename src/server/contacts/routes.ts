import { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth/routes.js';
import { frequentContacts, searchUsers } from '../realtime/contacts.js';

export async function contactsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/contacts/frequent', async (req, reply) => {
    if (!(await requireAuth(req, reply))) return;
    const contacts = await frequentContacts(req.auth!.uid);
    return reply.send({ contacts });
  });

  app.get('/api/contacts/search', async (req, reply) => {
    if (!(await requireAuth(req, reply))) return;
    const q = String((req.query as { q?: string }).q ?? '').trim();
    if (q.length < 1) return reply.send({ results: [] });
    const results = await searchUsers(req.auth!.uid, q);
    return reply.send({ results });
  });
}
