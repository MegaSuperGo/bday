import { BRIEFING_SECTIONS, type AdminGuest, type BriefingSection, type GuestPublic, type GuestStatus } from '../../../shared/types';
import type { Env } from '../env';
import { randomToken, sha256Hex } from '../utils/crypto';
import { nowIso } from '../utils/http';

export interface GuestRow {
  id: number;
  first_name: string;
  name_key: string;
  progress: number;
  furthest_section: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  created_at: string;
}

const GUEST_SESSION_DAYS = 90;

export function statusOf(g: Pick<GuestRow, 'started_at' | 'completed_at'>): GuestStatus {
  if (g.completed_at) return 'COMPLETED';
  if (g.started_at) return 'IN_PROGRESS';
  return 'NOT_STARTED';
}

export function sectionIndex(s: string | null): number {
  return s ? BRIEFING_SECTIONS.indexOf(s as BriefingSection) : -1;
}

export function toPublic(g: GuestRow): GuestPublic {
  return {
    id: g.id,
    firstName: g.first_name,
    status: statusOf(g),
    progress: g.progress,
    furthestSection: (g.furthest_section as BriefingSection | null) ?? null,
    completedAt: g.completed_at,
  };
}

export function toAdmin(g: GuestRow & { chat_messages?: number }): AdminGuest {
  return {
    ...toPublic(g),
    startedAt: g.started_at,
    lastActivityAt: g.last_activity_at,
    chatMessages: g.chat_messages ?? 0,
    createdAt: g.created_at,
  };
}

export async function findGuestByKey(env: Env, key: string) {
  return env.DB.prepare('SELECT * FROM guests WHERE name_key = ?').bind(key).first<GuestRow>();
}

/** Creates a device session and marks the guest as started (idempotent). */
export async function openGuestSession(env: Env, guestId: number): Promise<string> {
  const token = randomToken();
  const hash = await sha256Hex(token);
  const now = nowIso();
  const expires = new Date(Date.now() + GUEST_SESSION_DAYS * 86400_000).toISOString();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO briefing_sessions (guest_id, token_hash, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(guestId, hash, now, now, expires),
    env.DB.prepare(
      'UPDATE guests SET started_at = COALESCE(started_at, ?), last_activity_at = ? WHERE id = ?',
    ).bind(now, now, guestId),
    // Keep the number of device sessions per guest small
    env.DB.prepare(
      `DELETE FROM briefing_sessions WHERE guest_id = ? AND id NOT IN
         (SELECT id FROM briefing_sessions WHERE guest_id = ? ORDER BY id DESC LIMIT 5)`,
    ).bind(guestId, guestId),
  ]);
  return token;
}

export async function guestFromToken(env: Env, token: string): Promise<GuestRow | null> {
  if (!token || token.length > 100) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT g.*, s.id AS session_id FROM briefing_sessions s
     JOIN guests g ON g.id = s.guest_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(hash, nowIso())
    .first<GuestRow & { session_id: number }>();
  if (!row) return null;
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare('UPDATE briefing_sessions SET last_seen_at = ? WHERE id = ?').bind(now, row.session_id),
    env.DB.prepare('UPDATE guests SET last_activity_at = ? WHERE id = ?').bind(now, row.id),
  ]);
  return row;
}

/** Only ever moves progress forward. */
export async function recordProgress(env: Env, guest: GuestRow, section: BriefingSection, progress: number) {
  const idx = sectionIndex(section);
  const current = sectionIndex(guest.furthest_section);
  const nextSection = idx > current ? section : guest.furthest_section;
  const nextProgress = Math.max(guest.progress, Math.min(100, Math.max(0, Math.round(progress))));
  await env.DB.prepare('UPDATE guests SET furthest_section = ?, progress = ?, last_activity_at = ? WHERE id = ?')
    .bind(nextSection, nextProgress, nowIso(), guest.id)
    .run();
  return { ...guest, furthest_section: nextSection, progress: nextProgress };
}

export async function markCompleted(env: Env, guest: GuestRow) {
  const now = nowIso();
  const furthest = sectionIndex(guest.furthest_section) >= sectionIndex('summary') ? guest.furthest_section : 'summary';
  await env.DB.prepare(
    'UPDATE guests SET completed_at = COALESCE(completed_at, ?), furthest_section = ?, progress = MAX(progress, 90), last_activity_at = ? WHERE id = ?',
  )
    .bind(now, furthest, now, guest.id)
    .run();
  return env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(guest.id).first<GuestRow>();
}
