import type { Env } from '../env';
import { decryptSecret, encryptSecret } from '../utils/crypto';
import { HttpError, nowIso } from '../utils/http';

export const GROQ_KEY_NAME = 'groq_api_key';

function requireKey(env: Env): string {
  if (!env.ENCRYPTION_KEY) {
    throw new HttpError(503, 'ENCRYPTION_NOT_CONFIGURED', 'ENCRYPTION_KEY ist nicht als Worker Secret gesetzt.');
  }
  return env.ENCRYPTION_KEY;
}

export async function storeSecret(env: Env, name: string, value: string) {
  const { iv, ciphertext } = await encryptSecret(value, requireKey(env), name);
  await env.DB.prepare(
    `INSERT INTO encrypted_secrets (name, iv, ciphertext, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET iv = excluded.iv, ciphertext = excluded.ciphertext, updated_at = excluded.updated_at`,
  )
    .bind(name, iv, ciphertext, nowIso())
    .run();
}

export async function loadSecret(env: Env, name: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT iv, ciphertext FROM encrypted_secrets WHERE name = ?')
    .bind(name)
    .first<{ iv: string; ciphertext: string }>();
  if (!row || !env.ENCRYPTION_KEY) return null;
  try {
    return await decryptSecret(row.iv, row.ciphertext, env.ENCRYPTION_KEY, name);
  } catch {
    // Wrong/rotated encryption key – treat as not configured
    return null;
  }
}

export async function secretMeta(env: Env, name: string): Promise<{ exists: boolean; updatedAt: string | null }> {
  const row = await env.DB.prepare('SELECT updated_at FROM encrypted_secrets WHERE name = ?')
    .bind(name)
    .first<{ updated_at: string }>();
  return { exists: !!row, updatedAt: row?.updated_at ?? null };
}

export async function deleteSecret(env: Env, name: string) {
  await env.DB.prepare('DELETE FROM encrypted_secrets WHERE name = ?').bind(name).run();
}
