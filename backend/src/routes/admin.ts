import type { AdminStats, AiSettingsView } from '../../../shared/types';
import type { Env } from '../env';
import { cookieHeader, createAdminSession, destroyAdminSession, requireAdmin } from '../services/adminAuth';
import { groqChat, groqModels } from '../services/groq';
import { statusOf, toAdmin, type GuestRow } from '../services/guests';
import { clientKey, rateLimit } from '../services/rateLimit';
import { deleteSecret, GROQ_KEY_NAME, loadSecret, secretMeta, storeSecret } from '../services/secrets';
import { getAiSettings, getEventSettings, saveAiSettings, saveEventSettings, validateEventSettings } from '../services/settings';
import { verifyPassword } from '../utils/crypto';
import { HttpError, json, nowIso, readJson } from '../utils/http';
import { cleanFirstName, nameKey } from '../utils/names';

export async function login(req: Request, env: Env) {
  const ip = await clientKey(req, env);
  await rateLimit(env, `admin-login:${ip}`, 5, 900, 'Zu viele Anmeldeversuche. Bitte 15 Minuten warten.');
  if (!env.ADMIN_PASSWORD_HASH) {
    throw new HttpError(503, 'ADMIN_NOT_CONFIGURED', 'ADMIN_PASSWORD_HASH ist nicht als Worker Secret gesetzt.');
  }
  const body = await readJson(req);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 256 || !(await verifyPassword(password, env.ADMIN_PASSWORD_HASH))) {
    throw new HttpError(401, 'INVALID_PASSWORD', 'Zugriff verweigert.');
  }
  const { token, maxAge } = await createAdminSession(env);
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(env, token, maxAge) });
}

export async function logout(req: Request, env: Env) {
  try {
    const hash = await requireAdmin(req, env);
    await destroyAdminSession(env, hash);
  } catch {
    /* already logged out */
  }
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(env, '', 0) });
}

export async function session(req: Request, env: Env) {
  await requireAdmin(req, env);
  return json({ authenticated: true });
}

async function guestsWithUsage(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT g.*, (SELECT COUNT(*) FROM chat_usage c WHERE c.guest_id = g.id) AS chat_messages
     FROM guests g ORDER BY g.created_at ASC, g.id ASC`,
  ).all<GuestRow & { chat_messages: number }>();
  return results;
}

export async function stats(req: Request, env: Env) {
  await requireAdmin(req, env);
  const guests = await guestsWithUsage(env);
  const s: AdminStats = { totalGuests: guests.length, completed: 0, inProgress: 0, notStarted: 0, chatMessagesTotal: 0 };
  for (const g of guests) {
    const st = statusOf(g);
    if (st === 'COMPLETED') s.completed++;
    else if (st === 'IN_PROGRESS') s.inProgress++;
    else s.notStarted++;
    s.chatMessagesTotal += g.chat_messages;
  }
  return json(s);
}

export async function listGuests(req: Request, env: Env) {
  await requireAdmin(req, env);
  return json({ guests: (await guestsWithUsage(env)).map(toAdmin) });
}

function parseName(v: unknown): string {
  const name = cleanFirstName(v);
  if (!name) throw new HttpError(400, 'VALIDATION', 'Bitte einen gültigen Vornamen eingeben (nur Buchstaben, max. 40 Zeichen).');
  return name;
}

async function assertUnique(env: Env, key: string, exceptId?: number) {
  const row = await env.DB.prepare('SELECT id FROM guests WHERE name_key = ?').bind(key).first<{ id: number }>();
  if (row && row.id !== exceptId) throw new HttpError(409, 'DUPLICATE', 'Ein Gast mit diesem Namen existiert bereits.');
}

export async function createGuest(req: Request, env: Env) {
  await requireAdmin(req, env);
  const name = parseName((await readJson(req)).firstName);
  const key = nameKey(name);
  await assertUnique(env, key);
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM guests').first<{ n: number }>();
  if ((count?.n ?? 0) >= 50) throw new HttpError(400, 'LIMIT', 'Maximal 50 Gäste.');
  const row = await env.DB.prepare('INSERT INTO guests (first_name, name_key, created_at) VALUES (?, ?, ?) RETURNING *')
    .bind(name, key, nowIso())
    .first<GuestRow>();
  return json({ guest: toAdmin(row!) }, 201);
}

function guestId(params: Record<string, string>): number {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'VALIDATION', 'Ungültige Gast-ID.');
  return id;
}

export async function updateGuest(req: Request, env: Env, params: Record<string, string>) {
  await requireAdmin(req, env);
  const id = guestId(params);
  const name = parseName((await readJson(req)).firstName);
  const key = nameKey(name);
  await assertUnique(env, key, id);
  const row = await env.DB.prepare('UPDATE guests SET first_name = ?, name_key = ? WHERE id = ? RETURNING *').bind(name, key, id).first<GuestRow>();
  if (!row) throw new HttpError(404, 'NOT_FOUND', 'Gast nicht gefunden.');
  return json({ guest: toAdmin(row) });
}

export async function deleteGuest(req: Request, env: Env, params: Record<string, string>) {
  await requireAdmin(req, env);
  const id = guestId(params);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM briefing_sessions WHERE guest_id = ?').bind(id),
    env.DB.prepare('DELETE FROM chat_usage WHERE guest_id = ?').bind(id),
    env.DB.prepare('DELETE FROM guests WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}

export async function resetGuest(req: Request, env: Env, params: Record<string, string>) {
  await requireAdmin(req, env);
  const id = guestId(params);
  const res = await env.DB.batch([
    env.DB.prepare(
      'UPDATE guests SET progress = 0, furthest_section = NULL, started_at = NULL, completed_at = NULL, last_activity_at = NULL WHERE id = ?',
    ).bind(id),
    // Invalidate device sessions so the guest goes through identification again
    env.DB.prepare('DELETE FROM briefing_sessions WHERE guest_id = ?').bind(id),
  ]);
  if (!res[0].meta.changes) throw new HttpError(404, 'NOT_FOUND', 'Gast nicht gefunden.');
  return json({ ok: true });
}

export async function getEvent(req: Request, env: Env) {
  await requireAdmin(req, env);
  return json({ event: await getEventSettings(env) });
}

export async function putEvent(req: Request, env: Env) {
  await requireAdmin(req, env);
  const event = validateEventSettings(await readJson(req));
  await saveEventSettings(env, event);
  return json({ event });
}

async function aiView(env: Env): Promise<AiSettingsView> {
  const [ai, meta] = await Promise.all([getAiSettings(env), secretMeta(env, GROQ_KEY_NAME)]);
  return { model: ai.model, systemPrompt: ai.systemPrompt, hasApiKey: meta.exists, keyUpdatedAt: meta.updatedAt, lastTest: ai.lastTest };
}

export async function getAi(req: Request, env: Env) {
  await requireAdmin(req, env);
  return json({ ai: await aiView(env), encryptionConfigured: !!env.ENCRYPTION_KEY });
}

export async function putAi(req: Request, env: Env) {
  await requireAdmin(req, env);
  const body = await readJson(req);
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
  if (!/^[\w./:-]{2,100}$/.test(model)) throw new HttpError(400, 'VALIDATION', 'Ungültiger Modellname.');
  if (systemPrompt.length < 20 || systemPrompt.length > 6000) throw new HttpError(400, 'VALIDATION', 'Der Systemprompt muss zwischen 20 und 6000 Zeichen lang sein.');
  const ai = await getAiSettings(env);
  await saveAiSettings(env, { ...ai, model, systemPrompt });
  return json({ ai: await aiView(env) });
}

export async function putAiKey(req: Request, env: Env) {
  await requireAdmin(req, env);
  const body = await readJson(req);
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!/^[\w-]{20,200}$/.test(apiKey)) throw new HttpError(400, 'VALIDATION', 'Das sieht nicht nach einem gültigen Groq API-Schlüssel aus.');
  await storeSecret(env, GROQ_KEY_NAME, apiKey);
  const ai = await getAiSettings(env);
  await saveAiSettings(env, { ...ai, lastTest: null });
  return json({ ai: await aiView(env) });
}

export async function deleteAiKey(req: Request, env: Env) {
  await requireAdmin(req, env);
  await deleteSecret(env, GROQ_KEY_NAME);
  const ai = await getAiSettings(env);
  await saveAiSettings(env, { ...ai, lastTest: null });
  return json({ ai: await aiView(env) });
}

/** Tests the stored key: lists models and sends a tiny completion with the selected model. */
export async function testAi(req: Request, env: Env) {
  await requireAdmin(req, env);
  const ip = await clientKey(req, env);
  await rateLimit(env, `admin-test:${ip}`, 10, 600);
  const apiKey = await loadSecret(env, GROQ_KEY_NAME);
  if (!apiKey) throw new HttpError(400, 'NO_KEY', 'Es ist noch kein API-Schlüssel gespeichert.');
  const ai = await getAiSettings(env);
  let models: string[] = [];
  let ok = false;
  let message: string;
  try {
    models = await groqModels(apiKey);
    const r = await groqChat(apiKey, ai.model, [{ role: 'user', content: 'Antworte nur mit: Verbindung bestätigt.' }]);
    ok = true;
    message = `Verbindung erfolgreich. Modell ${r.model} antwortet.`;
  } catch (e) {
    message = e instanceof HttpError ? e.message : 'Unbekannter Fehler.';
  }
  const lastTest = { ok, at: nowIso(), message };
  await saveAiSettings(env, { ...ai, lastTest });
  return json({ ok, message, models, ai: await aiView(env) });
}
