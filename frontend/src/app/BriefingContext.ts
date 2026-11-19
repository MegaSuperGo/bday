import { createContext, useContext } from 'react';
import type { EventSettings, GuestPublic } from '../../../shared/types';

export interface BriefingState {
  token: string;
  guest: GuestPublic;
  event: EventSettings;
  chatAvailable: boolean;
  setGuest: (g: GuestPublic) => void;
  /** global system notice (easter eggs, errors) */
  notify: (text: string, tone?: 'info' | 'warn' | 'alert') => void;
  logout: () => void;
}

export const BriefingContext = createContext<BriefingState | null>(null);

export function useBriefing(): BriefingState {
  const ctx = useContext(BriefingContext);
  if (!ctx) throw new Error('useBriefing outside provider');
  return ctx;
}
