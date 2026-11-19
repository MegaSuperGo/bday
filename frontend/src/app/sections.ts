import type { BriefingSection } from '../../../shared/types';

export const SECTION_META: Record<BriefingSection, { code: string; label: string }> = {
  welcome: { code: '00', label: 'Begrüssung' },
  overview: { code: '01', label: 'Missionsübersicht' },
  meetup: { code: '02', label: 'Der Treffpunkt' },
  escape: { code: '03', label: 'Escape Room' },
  sushi: { code: '04', label: 'Sushi-Finale' },
  summary: { code: '05', label: 'Dossier' },
  countdown: { code: '06', label: 'Countdown' },
};
