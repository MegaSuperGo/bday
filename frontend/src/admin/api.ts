import { apiFetch } from '../services/api';

/** Admin requests always carry the HttpOnly session cookie + CSRF header. */
export const adminApi = {
  get: <T,>(path: string) => apiFetch<T>(`/api/admin${path}`, { credentials: true }),
  post: <T,>(path: string, body?: unknown) => apiFetch<T>(`/api/admin${path}`, { method: 'POST', body: body ?? {}, credentials: true }),
  put: <T,>(path: string, body: unknown) => apiFetch<T>(`/api/admin${path}`, { method: 'PUT', body, credentials: true }),
  patch: <T,>(path: string, body: unknown) => apiFetch<T>(`/api/admin${path}`, { method: 'PATCH', body, credentials: true }),
  del: <T,>(path: string) => apiFetch<T>(`/api/admin${path}`, { method: 'DELETE', credentials: true }),
};

const dt = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' });
export const fmtDate = (iso: string | null) => (iso ? dt.format(new Date(iso)) : '—');

export function relative(iso: string | null): string {
  if (!iso) return '—';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'gerade eben';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  return fmtDate(iso);
}

export const STATUS_LABEL = { NOT_STARTED: 'Nicht gestartet', IN_PROGRESS: 'In Bearbeitung', COMPLETED: 'Abgeschlossen' } as const;
