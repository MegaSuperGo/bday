import type { ApiError } from '../../../shared/types';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function errorResponse(err: HttpError): Response {
  const body: ApiError = { error: err.message, code: err.code };
  return json(body, err.status);
}

const MAX_BODY = 32 * 1024;

/** Parse a JSON body with a size limit. Throws HttpError(400) on garbage. */
export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  const len = Number(req.headers.get('Content-Length') ?? '0');
  if (len > MAX_BODY) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Anfrage zu gross.');
  const text = await req.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Anfrage zu gross.');
  try {
    const data = JSON.parse(text || '{}');
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error();
    return data as T;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'Ungültige Anfrage.');
  }
}

export const nowIso = () => new Date().toISOString();
