import { BRIEFING_SECTIONS, type BriefingSection } from '../../../shared/types';
import { SECTION_META } from '../app/sections';
import styles from './ProgressRail.module.css';

interface Props {
  active: BriefingSection;
  reached: number;
}

/** Vertical mission index – a real navigation, not decoration. */
export function ProgressRail({ active, reached }: Props) {
  const go = (s: BriefingSection) => {
    document.querySelector(`[data-section="${s}"]`)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };
  return (
    <nav className={styles.rail} aria-label="Briefing-Abschnitte">
      <ol>
        {BRIEFING_SECTIONS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => go(s)}
              className={`${styles.item} ${s === active ? styles.active : ''} ${i <= reached ? styles.reached : ''}`}
              aria-current={s === active ? 'step' : undefined}
            >
              <span className={`mono ${styles.label}`}>
                {SECTION_META[s].code} {SECTION_META[s].label}
              </span>
              <span className={styles.tick} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
