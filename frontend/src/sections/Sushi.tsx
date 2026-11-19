import { useCallback, useRef } from 'react';
import { useSectionMotion } from '../animations/useSectionMotion';
import { useBriefing } from '../app/BriefingContext';
import { MapLinks } from '../components/MapLinks';
import { SectionHeader } from '../components/SectionHeader';
import { ThreeStage } from '../components/ThreeStage';
import { sound } from '../services/sound';
import s from './shared.module.css';
import styles from './Sushi.module.css';

const loadSushi = () => import('../three/sushiScene').then((m) => m.createSushiScene);

export function Sushi() {
  const { event, notify } = useBriefing();
  const ref = useRef<HTMLElement>(null);
  useSectionMotion(ref);
  const r = event.restaurant;

  const onEvent = useCallback(
    (name: string) => {
      if (name === 'tap') sound.play('tick');
      if (name === 'nibble') {
        sound.play('alert');
        notify('Bitte nicht vor Missionsbeginn verzehren. Dieses Exemplar ist Beweismaterial.', 'warn');
      }
    },
    [notify],
  );

  return (
    <section ref={ref} data-section="sushi" className={styles.sushi} aria-labelledby="sushi-title">
      <div className={`${s.inner} ${styles.pad}`}>
        <SectionHeader index="04" kicker="Mission 03 · Das kulinarische Finale" status="Belohnung" />
      </div>
      <div className={styles.stageWrap}>
        <ThreeStage
          load={loadSushi}
          progressTrigger={ref}
          label="3D-Darstellung: Nigiri und Maki auf einer Schieferplatte"
          className={styles.stage}
          onEvent={onEvent}
          hint="Ziehen zum Drehen"
          hintPosition="top"
        />
        <h2 id="sushi-title" className={styles.title} data-reveal>
          Das kulinarische
          <br />
          Finale
        </h2>
      </div>
      <div className={`${s.inner} ${styles.pad} ${styles.lower}`}>
        <div>
          <span className={s.speaker} data-reveal>
            JARVIS
          </span>
          <p className={s.jarvis} data-reveal>
            {event.missions.sushi || 'Nach erfolgreichem Abschluss der vorherigen Mission erwartet dich eine wohlverdiente Stärkung.'}
          </p>
        </div>
        <div className={`${s.panel} brackets ${styles.card}`} data-scan>
          <span className={`mono ${styles.cardHead}`}>Zielort</span>
          <p className={styles.name}>{r.name}</p>
          <p className={`mono ${s.muted}`}>{[r.address, r.city].filter(Boolean).join(', ') || r.city}</p>
          {r.time && <p className="mono">Reservation · {r.time} Uhr</p>}
          {r.detail && <p className={s.muted}>{r.detail}</p>}
          <MapLinks place={r} />
        </div>
      </div>
    </section>
  );
}
