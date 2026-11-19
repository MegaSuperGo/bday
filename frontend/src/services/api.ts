import type { ApiError } from '../../../shared/types';

const RAW = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';
export const API_URL = RAW.replace(/\/$/, '');
/** True when the frontend was built without a backend URL – the UI shows a setup state. */
export const API_CONFIGURED = API_URL.length > 0;

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: string;
  body?: unknown;
  token?: string | null;
  /** send cookies (admin) */
  credentials?: boolean;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, opts: Options = {}): Promise<T> {
  if (!API_CONFIGURED) throw new ApiRequestError(0, 'NOT_CONFIGURED', 'Backend nicht konfiguriert.');
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.credentials) headers['X-Nexus-Client'] = '1';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: opts.credentials ? 'include' : 'omit',
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiRequestError(0, 'NETWORK', 'Verbindung zum NEXUS-Server fehlgeschlagen.');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(res.status, err.code ?? 'HTTP_' + res.status, err.error ?? `Serverfehler (${res.status}).`);
  }
  return data as T;
}
