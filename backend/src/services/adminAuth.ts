import type { Env } from '../env';
import { randomToken, sha256Hex } from '../utils/crypto';
import { HttpError, nowIso } from '../utils/http';

export const ADMIN_COOKIE = 'nexus_admin';
const SESSION_HOURS = 12;

export function cookieHeader(env: Env, value: string, maxAge: number): string {
  const sameSite = (env.COOKIE_SAMESITE ?? 'None').trim();
  const normalized = ['Strict', 'Lax', 'None'].includes(sameSite) ? sameSite : 'None';
  let c = `${ADMIN_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=${normalized}; Max-Age=${maxAge}`;
  // Cross-site deployments (github.io -> workers.dev) need a partitioned cookie (CHIPS)
  if (normalized === 'None') c += '; Partitioned';
  return c;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export async function createAdminSession(env: Env): Promise<{ token: string; maxAge: number }> {
  const token = randomToken();
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_HOURS * 3600_000);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)').bind(
      await sha256Hex(token),
      now.toISOString(),
      expires.toISOString(),
    ),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(now.toISOString()),
  ]);
  return { token, maxAge: SESSION_HOURS * 3600 };
}

export async function requireAdmin(req: Request, env: Env): Promise<string> {
  const token = readCookie(req, ADMIN_COOKIE);
  if (!token || token.length > 100) throw new HttpError(401, 'UNAUTHENTICATED', 'Nicht angemeldet.');
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').bind(hash).first<{ expires_at: string }>();
  if (!row || row.expires_at < nowIso()) throw new HttpError(401, 'SESSION_EXPIRED', 'Sitzung abgelaufen. Bitte erneut anmelden.');
  return hash;
}

export async function destroyAdminSession(env: Env, hash: string) {
  await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(hash).run();
}
