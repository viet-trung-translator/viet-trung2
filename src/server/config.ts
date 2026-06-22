import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';

dotenv.config();

/**
 * Load the optional company terminology glossary from glossary.txt at the
 * project root. Lines starting with '#' or blank lines are ignored.
 */
function loadGlossary(): string {
  try {
    if (!existsSync('glossary.txt')) return '';
    return readFileSync('glossary.txt', 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .join('\n');
  } catch {
    return '';
  }
}

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
  jwtSecret: required('JWT_SECRET', 'dev-insecure-secret-change-me'),
  databaseUrl: process.env.DATABASE_URL ?? '',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-live-translate-preview',
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Company/factory/office terminology, injected into the translation prompt.
  glossary: loadGlossary(),
};

export type AppConfig = typeof config;
