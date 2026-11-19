import type { EventSettings } from '../../../shared/types';
import { formatOffset, tzOffsetMinutes, zonedToUtc } from '../../../shared/time';
import { placeQuery } from './maps';

export interface CalendarEvent {
  title: string;
  /** true when no end time was configured – the entry only marks the meetup */
  meetupOnly: boolean;
  start: Date;
  end: Date;
  location: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

export function buildCalendarEvent(e: EventSettings): CalendarEvent {
  const start = zonedToUtc(e.date, e.startTime, e.timezone);
  const meetupOnly = !e.endTime;
  const end = e.endTime ? zonedToUtc(e.date, e.endTime, e.timezone) : start;
  const lines: string[] = [];
  if (meetupOnly) {
    lines.push(`Hinweis: Die Endzeit ist noch nicht festgelegt. Dieser Eintrag markiert den Treffpunkt um ${e.startTime} Uhr.`, '');
  }
  if (e.calendarDescription) lines.push(e.calendarDescription);
  if (e.meeting.detail) lines.push('', `Treffpunkt: ${e.meeting.detail}`);
  if (e.additionalInstructions) lines.push('', e.additionalInstructions);
  return {
    title: meetupOnly ? `${e.title} – Treffpunkt ${e.startTime}` : e.title,
    meetupOnly,
    start,
    end,
    location: placeQuery(e.meeting),
    description: lines.join('\n').trim(),
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime ?? e.startTime,
    timezone: e.timezone,
  };
}

const compact = (date: string, time: string) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function icsEscape(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines to 75 octets as required by RFC 5545. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

const ZURICH_VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Zurich',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19810329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19961027T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

export function buildIcs(ev: CalendarEvent, uid = `operation-birthday-${ev.date}@nexus`): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NEXUS//Operation Birthday//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...ZURICH_VTIMEZONE,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART;TZID=${ev.timezone}:${compact(ev.date, ev.startTime)}`,
    `DTEND;TZID=${ev.timezone}:${compact(ev.date, ev.endTime)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `LOCATION:${icsEscape(ev.location)}`,
    `DESCRIPTION:${icsEscape(ev.description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(ev.title)}`,
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${compact(ev.date, ev.startTime)}/${compact(ev.date, ev.endTime)}`,
    ctz: ev.timezone,
    details: ev.description,
    location: ev.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function isoWithOffset(date: string, time: string, d: Date, tz: string) {
  return `${date}T${time}:00${formatOffset(tzOffsetMinutes(d, tz))}`;
}

export function outlookCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    startdt: isoWithOffset(ev.date, ev.startTime, ev.start, ev.timezone),
    enddt: isoWithOffset(ev.date, ev.endTime, ev.end, ev.timezone),
    body: ev.description,
    location: ev.location,
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function downloadIcs(ev: CalendarEvent) {
  const blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'operation-birthday.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
