import type { EventSettings, Place } from '../../../shared/types';
import { isValidDate, isValidTime } from '../../../shared/time';
import { DEFAULT_EVENT, DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT } from '../database/defaults';
import type { Env } from '../env';
import { HttpError, nowIso } from '../utils/http';

export interface AiSettings {
  model: string;
  systemPrompt: string;
  lastTest: { ok: boolean; at: string; message: string } | null;
}

const DEFAULT_AI: AiSettings = { model: DEFAULT_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT, lastTest: null };

async function readDoc<T>(env: Env, key: string): Promise<Partial<T> | null> {
  const row = await env.DB.prepare('SELECT value FROM event_settings WHERE key = ?').bind(key).first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as Partial<T>;
  } catch {
    return null;
  }
}

async function writeDoc(env: Env, key: string, value: unknown) {
  await env.DB.prepare(
    `INSERT INTO event_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  )
    .bind(key, JSON.stringify(value), nowIso())
    .run();
}

export async function getEventSettings(env: Env): Promise<EventSettings> {
  const stored = await readDoc<EventSettings>(env, 'event');
  if (!stored) return structuredClone(DEFAULT_EVENT);
  // Merge so newly added fields always exist
  return {
    ...DEFAULT_EVENT,
    ...stored,
    timezone: 'Europe/Zurich',
    meeting: { ...DEFAULT_EVENT.meeting, ...stored.meeting },
    escapeRoom: { ...DEFAULT_EVENT.escapeRoom, ...stored.escapeRoom },
    restaurant: { ...DEFAULT_EVENT.restaurant, ...stored.restaurant },
    missions: { ...DEFAULT_EVENT.missions, ...stored.missions },
  };
}

export async function getAiSettings(env: Env): Promise<AiSettings> {
  const stored = await readDoc<AiSettings>(env, 'ai');
  return { ...DEFAULT_AI, ...(stored ?? {}) };
}

export async function saveAiSettings(env: Env, ai: AiSettings) {
  await writeDoc(env, 'ai', ai);
}

// ---------------- validation ----------------

function str(v: unknown, field: string, max: number, required = false): string {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw new HttpError(400, 'VALIDATION', `Feld "${field}" ist ungültig.`);
  const t = v.trim();
  if (required && !t) throw new HttpError(400, 'VALIDATION', `Feld "${field}" ist erforderlich.`);
  if (t.length > max) throw new HttpError(400, 'VALIDATION', `Feld "${field}" ist zu lang (max. ${max} Zeichen).`);
  return t;
}

function coord(v: unknown, field: string, min: number, max: number): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, 'VALIDATION', `Koordinate "${field}" ist ungültig.`);
  return Math.round(n * 1e6) / 1e6;
}

function optTime(v: unknown, field: string): string {
  const t = str(v, field, 5);
  if (t && !isValidTime(t)) throw new HttpError(400, 'VALIDATION', `Uhrzeit "${field}" muss im Format HH:MM sein.`);
  return t;
}

function place(v: unknown, field: string, requireName: boolean): Place {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const lat = coord(o.lat, `${field}.lat`, -90, 90);
  const lng = coord(o.lng, `${field}.lng`, -180, 180);
  if ((lat === null) !== (lng === null)) throw new HttpError(400, 'VALIDATION', `Für "${field}" bitte beide Koordinaten angeben oder beide leer lassen.`);
  return {
    name: str(o.name, `${field}.name`, 120, requireName),
    address: str(o.address, `${field}.address`, 200),
    city: str(o.city, `${field}.city`, 80),
    detail: str(o.detail, `${field}.detail`, 600),
    lat,
    lng,
  };
}

export function validateEventSettings(input: Record<string, unknown>): EventSettings {
  const date = str(input.date, 'date', 10, true);
  if (!isValidDate(date)) throw new HttpError(400, 'VALIDATION', 'Datum muss im Format JJJJ-MM-TT sein.');
  const startTime = str(input.startTime, 'startTime', 5, true);
  if (!isValidTime(startTime)) throw new HttpError(400, 'VALIDATION', 'Startzeit muss im Format HH:MM sein.');
  const endRaw = optTime(input.endTime, 'endTime');
  const endTime = endRaw || null;
  if (endTime && endTime <= startTime) {
    throw new HttpError(400, 'VALIDATION', 'Die Endzeit muss nach der Startzeit liegen (gleicher Tag).');
  }
  const missions = (input.missions && typeof input.missions === 'object' ? input.missions : {}) as Record<string, unknown>;
  const esc = (input.escapeRoom ?? {}) as Record<string, unknown>;
  const rest = (input.restaurant ?? {}) as Record<string, unknown>;
  return {
    title: str(input.title, 'title', 80, true),
    date,
    startTime,
    endTime,
    timezone: 'Europe/Zurich',
    meeting: place(input.meeting, 'meeting', true),
    escapeRoom: { ...place(esc, 'escapeRoom', false), time: optTime(esc.time, 'escapeRoom.time') },
    restaurant: { ...place(rest, 'restaurant', true), time: optTime(rest.time, 'restaurant.time') },
    missions: {
      meetup: str(missions.meetup, 'missions.meetup', 800),
      escape: str(missions.escape, 'missions.escape', 800),
      sushi: str(missions.sushi, 'missions.sushi', 800),
    },
    additionalInstructions: str(input.additionalInstructions, 'additionalInstructions', 1500),
    calendarDescription: str(input.calendarDescription, 'calendarDescription', 1500),
  };
}

export async function saveEventSettings(env: Env, settings: EventSettings) {
  await writeDoc(env, 'event', settings);
}
