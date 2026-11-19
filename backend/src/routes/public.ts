import { BRIEFING_SECTIONS, type BriefingPayload, type BriefingSection, type ChatResponse, type IdentifyResponse } from '../../../shared/types';
import type { Env } from '../env';
import { groqChat, sanitizeHistory } from '../services/groq';
import { findGuestByKey, guestFromToken, markCompleted, openGuestSession, recordProgress, sectionIndex, toPublic, type GuestRow } from '../services/guests';
import { buildSystemPrompt } from '../services/prompt';
import { clientKey, rateLimit } from '../services/rateLimit';
import { GROQ_KEY_NAME, loadSecret, secretMeta } from '../services/secrets';
import { getAiSettings, getEventSettings } from '../services/settings';
import { HttpError, json, nowIso, readJson } from '../utils/http';
import { cleanFirstName, nameKey } from '../utils/names';

async function payload(env: Env, guest: GuestRow): Promise<BriefingPayload> {
  const [event, key] = await Promise.all([getEventSettings(env), secretMeta(env, GROQ_KEY_NAME)]);
  return { guest: toPublic(guest), event, chat: { available: key.exists && !!env.ENCRYPTION_KEY } };
}

async function requireGuest(req: Request, env: Env): Promise<GuestRow> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const guest = token ? await guestFromToken(env, token) : null;
  if (!guest) throw new HttpError(401, 'GUEST_UNAUTHENTICATED', 'Identifikation erforderlich.');
  return guest;
}

export async function identify(req: Request, env: Env) {
  const ip = await clientKey(req, env);
  await rateLimit(env, `identify:${ip}`, 10, 600, 'Zu viele Identifikationsversuche. Bitte in einigen Minuten erneut versuchen.');
  const body = await readJson(req);
  const firstName = cleanFirstName(body.firstName);
  if (!firstName) throw new HttpError(400, 'VALIDATION', 'Bitte gib deinen Vornamen ein.');
  const guest = await findGuestByKey(env, nameKey(firstName));
  if (!guest) throw new HttpError(404, 'UNKNOWN_GUEST', 'Identität nicht erkannt. Dieser Name ist nicht auf der Gästeliste.');
  const token = await openGuestSession(env, guest.id);
  const fresh = (await env.DB.prepare('SELECT * FROM guests WHERE id = ?').bind(guest.id).first<GuestRow>())!;
  const res: IdentifyResponse = { token, ...(await payload(env, fresh)) };
  return json(res);
}

export async function briefing(req: Request, env: Env) {
  const guest = await requireGuest(req, env);
  return json(await payload(env, guest));
}

export async function progress(req: Request, env: Env) {
  const guest = await requireGuest(req, env);
  const body = await readJson(req);
  const section = body.section as BriefingSection;
  if (!BRIEFING_SECTIONS.includes(section)) throw new HttpError(400, 'VALIDATION', 'Unbekannter Abschnitt.');
  const pct = typeof body.progress === 'number' ? body.progress : 0;
  const updated = await recordProgress(env, guest, section, pct);
  return json({ guest: toPublic(updated) });
}

export async function complete(req: Request, env: Env) {
  const guest = await requireGuest(req, env);
  // The summary can only be completed by a guest that actually scrolled through the missions.
  if (sectionIndex(guest.furthest_section) < sectionIndex('sushi')) {
    throw new HttpError(409, 'NOT_REACHED', 'Das Briefing wurde noch nicht vollständig angesehen.');
  }
  const updated = await markCompleted(env, guest);
  return json({ guest: toPublic(updated!) });
}

export async function chat(req: Request, env: Env) {
  const guest = await requireGuest(req, env);
  const ip = await clientKey(req, env);
  await rateLimit(env, `chat-ip:${ip}`, 40, 600);
  await rateLimit(env, `chat-guest:${guest.id}`, 20, 600, 'JARVIS benötigt eine kurze Pause. Bitte in ein paar Minuten erneut fragen.');
  await rateLimit(env, `chat-guest-day:${guest.id}`, 150, 86400, 'Das Tageskontingent für Fragen ist erreicht.');

  const body = await readJson(req);
  const history = sanitizeHistory(body.messages);

  const apiKey = await loadSecret(env, GROQ_KEY_NAME);
  if (!apiKey) throw new HttpError(503, 'CHAT_NOT_CONFIGURED', 'JARVIS ist noch nicht mit dem KI-Kern verbunden. Der Gastgeber muss den Groq API-Schlüssel hinterlegen.');

  const [event, ai] = await Promise.all([getEventSettings(env), getAiSettings(env)]);
  const system = buildSystemPrompt(ai.systemPrompt, event, guest.first_name);
  const result = await groqChat(apiKey, ai.model, [{ role: 'system', content: system }, ...history]);

  await env.DB.prepare(
    'INSERT INTO chat_usage (guest_id, created_at, model, prompt_tokens, completion_tokens) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(guest.id, nowIso(), result.model, result.promptTokens, result.completionTokens)
    .run();

  const res: ChatResponse = { reply: result.reply, model: result.model };
  return json(res);
}

export async function health(_req: Request, env: Env) {
  let db = false;
  try {
    await env.DB.prepare('SELECT 1 FROM guests LIMIT 1').first();
    db = true;
  } catch {
    db = false;
  }
  return json({ ok: db, service: 'nexus' });
}
