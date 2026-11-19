import { Countdown } from '../sections/Countdown';
import { Escape } from '../sections/Escape';
import { Meetup } from '../sections/Meetup';
import { Overview } from '../sections/Overview';
import { Summary } from '../sections/Summary';
import { Sushi } from '../sections/Sushi';
import { Welcome } from '../sections/Welcome';
import type { Completion } from './useBriefingTracker';

/** The single continuous briefing. Sections are ordered as in BRIEFING_SECTIONS. */
export default function Briefing({ rootRef, completion }: { rootRef: (el: HTMLElement | null) => void; completion: Completion }) {
  return (
    <main ref={rootRef}>
      <Welcome />
      <Overview />
      <Meetup />
      <Escape />
      <Sushi />
      <Summary completion={completion} />
      <Countdown />
    </main>
  );
}
