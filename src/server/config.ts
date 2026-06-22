import dotenv from 'dotenv';

dotenv.config();

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
};

export type AppConfig = typeof config;
