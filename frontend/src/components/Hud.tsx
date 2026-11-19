import { useRef } from 'react';
import type { BriefingSection } from '../../../shared/types';
import { useBriefing } from '../app/BriefingContext';
import { SECTION_META } from '../app/sections';
import { useZurichClock } from '../hooks/useZurichClock';
import { SoundToggle } from './SoundToggle';
import styles from './Hud.module.css';

interface Props {
  active: BriefingSection;
  progress: number;
}

export function Hud({ active, progress }: Props) {
  const { event, chatAvailable, notify } = useBriefing();
  const clock = useZurichClock();
  const clicks = useRef<number[]>([]);
  const missionId = `OP-BDAY-${event.date.replace(/-/g, '')}`;
  const [y, m, d] = event.date.split('-');

  // Easter egg: five quick clicks on the mission identifier
  const onIdClick = () => {
    const now = Date.now();
    clicks.current = [...clicks.current.filter((t) => now - t < 2000), now];
    if (clicks.current.length >= 5) {
      clicks.current = [];
      notify('Sicherheitsfreigabe Stufe 7 erteilt. Dahinter liegt allerdings nur noch mehr Geburtstag.', 'info');
    }
  };

  const meta = SECTION_META[active];
  return (
    <header className={styles.hud}>
      <div className={styles.left}>
        <span className={styles.glyph} aria-hidden />
        <span className={`mono ${styles.brand}`}>NEXUS</span>
        <button type="button" className={`mono ${styles.id}`} onClick={onIdClick} aria-label={`Missionskennung ${missionId}`}>
          {missionId}
        </button>
      </div>

      <div className={`mono ${styles.center}`} aria-live="polite">
        <span className={styles.dim}>ABSCHNITT {meta.code}</span>
        <span>{meta.label}</span>
      </div>

      <div className={styles.right}>
        <span className={`mono ${styles.meta}`}>
          <span className={styles.dim}>LUZERN</span> {clock}
        </span>
        <span className={`mono ${styles.meta}`}>
          <span className={styles.dim}>EINSATZ</span> {d}.{m}.{y}
        </span>
        <span className={`mono ${styles.meta}`} title={chatAvailable ? 'JARVIS ist mit dem KI-Kern verbunden' : 'KI-Kern noch nicht konfiguriert'}>
          <i className={chatAvailable ? styles.ok : styles.off} aria-hidden />
          KI {chatAvailable ? 'AKTIV' : 'OFFLINE'}
        </span>
        <span className={`mono ${styles.pct}`} aria-label={`Fortschritt ${progress} Prozent`}>
          {String(progress).padStart(3, '0')}%
        </span>
        <SoundToggle className={styles.sound} />
      </div>
      <div className={styles.bar} style={{ transform: `scaleX(${progress / 100})` }} aria-hidden />
    </header>
  );
}
