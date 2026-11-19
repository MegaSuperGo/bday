/**
 * Shared contract between the Worker API and the frontend.
 * Only plain data types live here – no runtime dependencies.
 */

export type GuestStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

/** Briefing sections in scroll order. Used for progress tracking. */
export const BRIEFING_SECTIONS = [
  'welcome',
  'overview',
  'meetup',
  'escape',
  'sushi',
  'summary',
  'countdown',
] as const;
export type BriefingSection = (typeof BRIEFING_SECTIONS)[number];

export interface Place {
  /** Display name, e.g. "Bushaltestelle Kantonalbank" */
  name: string;
  /** Street address – may be empty if not yet configured */
  address: string;
  city: string;
  /** Free text detail shown to guests */
  detail: string;
  /** Optional coordinates (WGS84). null = not configured */
  lat: number | null;
  lng: number | null;
}

export interface MissionTexts {
  meetup: string;
  escape: string;
  sushi: string;
}

/** Event configuration as editable in the admin dashboard. */
export interface EventSettings {
  title: string;
  /** ISO date YYYY-MM-DD, interpreted in `timezone` */
  date: string;
  /** HH:MM, interpreted in `timezone` */
  startTime: string;
  /** HH:MM or null – never invented */
  endTime: string | null;
  timezone: 'Europe/Zurich';
  meeting: Place;
  escapeRoom: Place & { time: string };
  restaurant: Place & { time: string };
  missions: MissionTexts;
  additionalInstructions: string;
  calendarDescription: string;
}

export interface GuestPublic {
  id: number;
  firstName: string;
  status: GuestStatus;
  progress: number;
  furthestSection: BriefingSection | null;
  completedAt: string | null;
}

export interface BriefingPayload {
  guest: GuestPublic;
  event: EventSettings;
  chat: { available: boolean };
}

export interface IdentifyResponse extends BriefingPayload {
  token: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
}

export interface AdminGuest {
  id: number;
  firstName: string;
  status: GuestStatus;
  progress: number;
  furthestSection: BriefingSection | null;
  startedAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
  chatMessages: number;
  createdAt: string;
}

export interface AdminStats {
  totalGuests: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  chatMessagesTotal: number;
}

export interface AiSettingsView {
  model: string;
  systemPrompt: string;
  hasApiKey: boolean;
  keyUpdatedAt: string | null;
  lastTest: { ok: boolean; at: string; message: string } | null;
}

export interface ApiError {
  error: string;
  code: string;
}
