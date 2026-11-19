import { describe, expect, it } from 'vitest';
import type { EventSettings } from '../../../shared/types';
import { buildCalendarEvent, buildIcs, googleCalendarUrl, outlookCalendarUrl } from './calendar';

const base: EventSettings = {
  title: 'OPERATION: BIRTHDAY',
  date: '2026-12-08',
  startTime: '14:20',
  endTime: null,
  timezone: 'Europe/Zurich',
  meeting: { name: 'Bushaltestelle Kantonalbank', address: '', city: 'Luzern', detail: 'Direkt vor der Kantonalbank.', lat: 47.048867, lng: 8.306236 },
  escapeRoom: { name: '', address: '', city: 'Luzern', detail: '', time: '', lat: null, lng: null },
  restaurant: { name: 'Nigishi Sushi', address: '', city: 'Luzern', detail: '', time: '', lat: null, lng: null },
  missions: { meetup: '', escape: '', sushi: '' },
  additionalInstructions: '',
  calendarDescription: 'Escape Room, danach Sushi; mit Freunden, Spass',
};

describe('calendar', () => {
  it('creates a clearly labelled meetup entry without an end time', () => {
    const ev = buildCalendarEvent(base);
    expect(ev.meetupOnly).toBe(true);
    expect(ev.title).toContain('Treffpunkt 14:20');
    expect(ev.start.toISOString()).toBe('2026-12-08T13:20:00.000Z');
    const ics = buildIcs(ev, 'uid@test');
    expect(ics).toContain('DTSTART;TZID=Europe/Zurich:20261208T142000');
    expect(ics).toContain('DTEND;TZID=Europe/Zurich:20261208T142000');
    expect(ics).toContain('BEGIN:VTIMEZONE');
    expect(ics.replace(/\r\n /g, '')).toContain('Sushi\\; mit Freunden\\, Spass');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('uses the configured end time', () => {
    const ev = buildCalendarEvent({ ...base, endTime: '21:30' });
    expect(ev.meetupOnly).toBe(false);
    expect(googleCalendarUrl(ev)).toContain('dates=20261208T142000%2F20261208T213000');
    expect(googleCalendarUrl(ev)).toContain('ctz=Europe%2FZurich');
    expect(outlookCalendarUrl(ev)).toContain('startdt=2026-12-08T14%3A20%3A00%2B01%3A00');
    expect(outlookCalendarUrl(ev)).toContain('enddt=2026-12-08T21%3A30%3A00%2B01%3A00');
  });
});
