import { describe, expect, it } from 'vitest';
import { countdownParts, formatGermanDate, isValidDate, isValidTime, tzOffsetMinutes, zonedToUtc } from './time';

describe('Europe/Zurich conversions', () => {
  it('resolves the event start in winter time (CET, UTC+1)', () => {
    expect(zonedToUtc('2026-12-08', '14:20', 'Europe/Zurich').toISOString()).toBe('2026-12-08T13:20:00.000Z');
  });
  it('resolves summer time (CEST, UTC+2)', () => {
    expect(zonedToUtc('2026-07-01', '14:20', 'Europe/Zurich').toISOString()).toBe('2026-07-01T12:20:00.000Z');
  });
  it('handles the DST switch day', () => {
    // 29 March 2026: clocks jump 02:00 -> 03:00
    expect(zonedToUtc('2026-03-29', '12:00', 'Europe/Zurich').toISOString()).toBe('2026-03-29T10:00:00.000Z');
    expect(tzOffsetMinutes(new Date('2026-03-29T00:30:00Z'), 'Europe/Zurich')).toBe(60);
  });
  it('formats the German weekday', () => {
    expect(formatGermanDate('2026-12-08')).toBe('Dienstag, 8. Dezember 2026');
  });
});

describe('countdown', () => {
  const target = new Date('2026-12-08T13:20:00Z');
  it('splits remaining time', () => {
    const p = countdownParts(target, new Date('2026-12-07T12:19:59Z'));
    expect(p).toMatchObject({ days: 1, hours: 1, minutes: 0, seconds: 1, started: false });
  });
  it('never goes negative', () => {
    const p = countdownParts(target, new Date('2026-12-08T13:20:01Z'));
    expect(p).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, started: true });
  });
});

describe('validators', () => {
  it('validates dates and times', () => {
    expect(isValidDate('2026-12-08')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidTime('14:20')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
  });
});
