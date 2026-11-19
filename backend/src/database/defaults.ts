import type { EventSettings } from '../../../shared/types';

/**
 * Initial event configuration. Only facts provided by the host are filled in.
 * Everything unknown stays empty/null and can be completed in the admin dashboard.
 *
 * Meeting point coordinates: official stop "Luzern, Kantonalbank"
 * (SBB/transport.opendata.ch stop id 8589801) – 47.048867, 8.306236.
 */
export const DEFAULT_EVENT: EventSettings = {
  title: 'OPERATION: BIRTHDAY',
  date: '2026-12-08',
  startTime: '14:20',
  endTime: null,
  timezone: 'Europe/Zurich',
  meeting: {
    name: 'Bushaltestelle Kantonalbank',
    address: '',
    city: 'Luzern',
    detail: 'Wir treffen uns direkt vor dem Gebäude der Kantonalbank.',
    lat: 47.048867,
    lng: 8.306236,
  },
  escapeRoom: {
    name: '',
    address: '',
    city: 'Luzern',
    detail: '',
    time: '',
    lat: null,
    lng: null,
  },
  restaurant: {
    name: 'Nigishi Sushi',
    address: '',
    city: 'Luzern',
    detail: '',
    time: '',
    lat: null,
    lng: null,
  },
  missions: {
    meetup: 'Dein erster Auftrag: Erscheine pünktlich am vereinbarten Treffpunkt.',
    escape: 'Dein nächstes Missionsziel erfordert logisches Denken, Teamwork und Kreativität. Die Aufgabe: Gemeinsam aus dem Escape Room entkommen.',
    sushi: 'Nach erfolgreichem Abschluss der vorherigen Mission erwartet dich eine wohlverdiente Stärkung.',
  },
  additionalInstructions: '',
  calendarDescription:
    'OPERATION: BIRTHDAY\n\n1. Treffpunkt: Bushaltestelle Kantonalbank, Luzern – direkt vor dem Gebäude der Kantonalbank.\n2. Escape Room\n3. Sushi-Finale: Nigishi Sushi, Luzern',
};

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export const DEFAULT_SYSTEM_PROMPT = `Du bist JARVIS, die persönliche KI des NEXUS-Intelligenzsystems. Du begleitest Gäste durch das Briefing zur OPERATION: BIRTHDAY.

Persönlichkeit:
- Ruhig, intelligent, professionell und präzise.
- Gelegentlich trocken-witzig, aber nie albern.
- Antworte in natürlichem, gepflegtem Deutsch (Schweizer Rechtschreibung: "ss" statt "ß").
- Fasse dich kurz: in der Regel 1–4 Sätze.
- Sprich den Gast mit "du" an.`;
