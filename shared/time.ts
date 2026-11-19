/**
 * Timezone helpers that work in browsers and in Cloudflare Workers
 * without any external dependency. They rely on Intl, which ships the
 * full IANA database (including Europe/Zurich DST rules).
 */

/** Offset (minutes, east of UTC positive) of `timeZone` at the given instant. */
export function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Convert a wall-clock time in `timeZone` to the absolute instant.
 * Uses two passes so that dates around DST transitions resolve correctly.
 */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  let offset = tzOffsetMinutes(new Date(naive), timeZone);
  let result = naive - offset * 60000;
  const offset2 = tzOffsetMinutes(new Date(result), timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    result = naive - offset * 60000;
  }
  return new Date(result);
}

/** Format an offset as "+01:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  started: boolean;
}

export function countdownParts(target: Date, now: Date = new Date()): CountdownParts {
  const totalMs = target.getTime() - now.getTime();
  if (totalMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, started: true };
  const s = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    totalMs,
    started: false,
  };
}

/** "Dienstag, 8. Dezember 2026" */
export function formatGermanDate(date: string, timeZone = 'Europe/Zurich'): string {
  const instant = zonedToUtc(date, '12:00', timeZone);
  return new Intl.DateTimeFormat('de-CH', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
}

export function isValidDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}
