import type { ChatMessage } from '../../../shared/types';
import { HttpError } from '../utils/http';

const GROQ_BASE = 'https://api.groq.com/openai/v1';

interface GroqCompletion {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  model?: string;
}

function mapGroqError(status: number, body: string): HttpError {
  let detail = '';
  try {
    detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? '';
  } catch {
    /* ignore */
  }
  if (status === 401 || status === 403) return new HttpError(502, 'GROQ_AUTH', 'Der Groq API-Schlüssel wurde abgelehnt.');
  if (status === 429) return new HttpError(503, 'GROQ_RATE_LIMIT', 'Das KI-Kontingent ist momentan ausgeschöpft. Bitte später erneut versuchen.');
  if (status === 404 || /model/i.test(detail)) return new HttpError(502, 'GROQ_MODEL', `Das konfigurierte Modell ist nicht verfügbar. ${detail}`.trim());
  return new HttpError(502, 'GROQ_ERROR', `Groq-Fehler (${status}). ${detail}`.trim());
}

export async function groqChat(apiKey: string, model: string, messages: { role: string; content: string }[]) {
  let res: Response;
  try {
    res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 500 }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new HttpError(504, 'GROQ_TIMEOUT', 'Die KI antwortet gerade nicht. Bitte erneut versuchen.');
  }
  const text = await res.text();
  if (!res.ok) throw mapGroqError(res.status, text);
  const data = JSON.parse(text) as GroqCompletion;
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new HttpError(502, 'GROQ_EMPTY', 'Die KI hat keine Antwort geliefert.');
  return {
    reply,
    model: data.model ?? model,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}

/** Lists chat-capable models available for the key. Also serves as connection test. */
export async function groqModels(apiKey: string): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new HttpError(504, 'GROQ_TIMEOUT', 'Groq ist nicht erreichbar.');
  }
  const text = await res.text();
  if (!res.ok) throw mapGroqError(res.status, text);
  const data = JSON.parse(text) as { data?: { id: string; active?: boolean }[] };
  return (data.data ?? [])
    .filter((m) => m.active !== false)
    .map((m) => m.id)
    .filter((id) => !/whisper|tts|guard|playai|orpheus|distil/i.test(id))
    .sort();
}

/** Validates and trims the client-provided conversation. */
export function sanitizeHistory(input: unknown): ChatMessage[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) {
    throw new HttpError(400, 'VALIDATION', 'Keine Nachricht übermittelt.');
  }
  const raw = input[input.length - 1] as Partial<ChatMessage> | null;
  if (!raw || typeof raw.content !== 'string' || raw.content.trim().length > 500) {
    throw new HttpError(400, 'VALIDATION', 'Nachricht ungültig oder zu lang (max. 500 Zeichen).');
  }
  const msgs: ChatMessage[] = [];
  for (const m of input.slice(-12)) {
    if (!m || typeof m !== 'object') continue;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const c = content.trim();
    if (!c) continue;
    msgs.push({ role, content: c.slice(0, role === 'user' ? 500 : 1500) });
  }
  const last = msgs[msgs.length - 1];
  if (!last || last.role !== 'user') throw new HttpError(400, 'VALIDATION', 'Die letzte Nachricht muss vom Gast stammen.');
  return msgs;
}
