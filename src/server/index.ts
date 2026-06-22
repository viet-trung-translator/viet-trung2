import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { authRoutes } from './auth/routes.js';
import { contactsRoutes } from './contacts/routes.js';
import { registerWebSocket } from './realtime/ws.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Built client lives at <repo>/client/dist. From dist/server or src/server we go up two.
const CLIENT_DIST = join(__dirname, '..', '..', 'client', 'dist');

async function main(): Promise<void> {
  const app = Fastify({
    logger: { level: config.isProd ? 'info' : 'debug' },
    trustProxy: true,
  });

  await app.register(fastifyWebsocket, {
    options: { maxPayload: 1 << 20 }, // 1 MB audio frames cap
  });

  // API routes
  await app.register(authRoutes);
  await app.register(contactsRoutes);
  await registerWebSocket(app);

  app.get('/api/health', async () => ({ ok: true, model: config.gemini.model }));

  // Serve the built SPA (if present) with history fallback.
  if (existsSync(CLIENT_DIST)) {
    await app.register(fastifyStatic, { root: CLIENT_DIST, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api') || req.raw.url?.startsWith('/ws')) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.sendFile('index.html');
    });
  } else {
    app.log.warn(`Client build not found at ${CLIENT_DIST}; serving API only.`);
  }

  // Best-effort migration on boot (no-op if DATABASE_URL missing will throw — log it).
  if (config.databaseUrl) {
    try {
      await migrate();
      app.log.info('database schema ready');
    } catch (err) {
      app.log.error({ err }, 'migration failed');
    }
  } else {
    app.log.warn('DATABASE_URL not set — skipping migration; auth/contacts will fail.');
  }

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`along 翻译 server listening on :${config.port}`);
}

main().catch((err) => {
  console.error('fatal startup error:', err);
  process.exit(1);
});
