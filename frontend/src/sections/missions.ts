import type { BriefingSection, EventSettings, Place } from '../../../shared/types';

export interface MissionInfo {
  no: string;
  section: BriefingSection;
  code: string;
  title: string;
  time: string | null;
  place: Place;
  placeLabel: string | null;
  description: string;
}

const label = (p: Place) => (p.name ? [p.name, p.city].filter(Boolean).join(', ') : null);

export function missionsFrom(e: EventSettings): MissionInfo[] {
  return [
    {
      no: '01',
      section: 'meetup',
      code: 'DER TREFFPUNKT',
      title: 'Der Treffpunkt',
      time: e.startTime,
      place: e.meeting,
      placeLabel: label(e.meeting),
      description: e.missions.meetup,
    },
    {
      no: '02',
      section: 'escape',
      code: 'ESCAPE ROOM',
      title: 'Escape Room',
      time: e.escapeRoom.time || null,
      place: e.escapeRoom,
      placeLabel: label(e.escapeRoom),
      description: e.missions.escape,
    },
    {
      no: '03',
      section: 'sushi',
      code: 'DAS KULINARISCHE FINALE',
      title: 'Sushi-Finale',
      time: e.restaurant.time || null,
      place: e.restaurant,
      placeLabel: label(e.restaurant),
      description: e.missions.sushi,
    },
  ];
}
