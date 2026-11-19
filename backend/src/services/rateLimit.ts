import type { Env } from '../env';
import { sha256Hex } from '../utils/crypto';
import { HttpError } from '../utils/http';

/**
 * Fixed-window rate limiter backed by D1.
 * Throws HttpError(429) once `limit` is exceeded within `windowSec`.
 */
export async function rateLimit(env: Env, key: string, limit: number, windowSec: number, message?: string) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(key, windowStart)
    .first<{ count: number }>();

  // Opportunistic cleanup of stale windows (~2% of calls)
  if (Math.random() < 0.02) {
    await env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - 2 * 86400).run();
  }

  if ((row?.count ?? 0) > limit) {
    throw new HttpError(429, 'RATE_LIMITED', message ?? 'Zu viele Anfragen. Bitte warte einen Moment.');
  }
}

/** Hash the client IP so raw addresses are never stored. */
export async function clientKey(req: Request, env: Env): Promise<string> {
  const ip = req.headers.get('CF-Connecting-IP') ?? req.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'local';
  return (await sha256Hex(`${env.ENCRYPTION_KEY ?? 'pepper'}|${ip}`)).slice(0, 32);
}
