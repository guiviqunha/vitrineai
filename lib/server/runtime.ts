import { env } from 'cloudflare:workers';
export function runtime() {
  return env as unknown as {
    DB: D1Database;
    BUCKET: R2Bucket;
    OWNER_EMAIL?: string;
    SITE_URL?: string;
    OPENAI_API_KEY?: string;
  };
}
export const db = () => runtime().DB;
export const origin = () =>
  runtime().SITE_URL || process.env.SITE_URL || 'http://localhost:3000';
