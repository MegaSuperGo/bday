import { Brain, Lightbulb, Users } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useSectionMotion } from '../animations/useSectionMotion';
import { useBriefing } from '../app/BriefingContext';
import { MapLinks } from '../components/MapLinks';
import { SectionHeader } from '../components/SectionHeader';
import { ThreeStage } from '../components/ThreeStage';
import { sound } from '../services/sound';
import s from './shared.module.css';
import styles from './Escape.module.css';

const loadSafe = () => import('../three/safeScene').then((m) => m.createSafeScene);

const LOCK_STATES: Record<string, { label: string; tone: 'warn' | 'accent' | 'ok' }> = {
  idle: { label: 'GESICHERT', tone: 'warn' },
  scan: { label: 'STRUKTURSCAN', tone: 'accent' },
  analyse: { label: 'MECHANISMUS ERKANNT', tone: 'accent' },
  unlocked: { label: 'ENTSPERRT', tone: 'ok' },
};

export function Escape() {
  const { event } = useBriefing();
  const ref = useRef<HTMLElement>(null);
  const [lock, setLock] = useState('idle');
  useSectionMotion(ref);

  const onEvent = useCallback((name: string) => {
    if (name === 'tick') sound.play('tick');
    if (name in LOCK_STATES) {
      setLock(name);
      if (name === 'unlocked') sound.play('confirm');
    }
  }, []);

  const room = event.escapeRoom;
  const configured = !!room.name;
  const [first, ...rest] = (event.missions.escape || '').split(/(?<=\.)\s+/);
  const state = LOCK_STATES[lock];

  return (
    <section ref={ref} data-section="escape" className={`${s.section} ${styles.escape}`} aria-labelledby="escape-title">
      <div className={s.inner}>
        <SectionHeader index="03" kicker="Mission 02 · Escape Room" status="Teamaufgabe" />
        <div className={styles.grid}>
          <div className={styles.visual}>
            <ThreeStage
              load={loadSafe}
              progressTrigger={ref}
              label="Rotierender 3D-Tresor mit Kombinationsschloss"
              className={styles.stage}
              onEvent={onEvent}
              hint="Ziehen zum Drehen · Drehrad antippen"
            />
            <div className={`mono ${styles.readout}`} aria-live="polite">
              <span className={styles.dim}>SCHLOSSSTATUS</span>
              <span className={styles[state.tone]}>{state.label}</span>
            </div>
          </div>

          <div className={styles.text}>
            <span className={s.speaker} data-reveal>
              JARVIS
            </span>
            {first && (
              <p className={s.jarvis} data-reveal>
                {first}
              </p>
            )}
            <h2 id="escape-title" className={styles.h2} data-reveal>
              {rest.length ? rest.join(' ') : 'Gemeinsam aus dem Escape Room entkommen.'}
            </h2>

            <ul className={styles.skills} data-reveal>
              <li>
                <Brain /> Logisches Denken
              </li>
              <li>
                <Users /> Teamwork
              </li>
              <li>
                <Lightbulb /> Kreativität
              </li>
            </ul>

            <div className={`${s.panel} brackets ${styles.venue}`} data-scan>
              <span className={`mono ${styles.venueHead}`}>Einsatzort</span>
              {configured ? (
                <>
                  <dl className={s.kv}>
                    <dt>Name</dt>
                    <dd>{room.name}</dd>
                    {(room.address || room.city) && (
                      <>
                        <dt>Adresse</dt>
                        <dd>{[room.address, room.city].filter(Boolean).join(', ')}</dd>
                      </>
                    )}
                    {room.time && (
                      <>
                        <dt>Beginn</dt>
                        <dd>{room.time} Uhr</dd>
                      </>
                    )}
                    {room.detail && (
                      <>
                        <dt>Hinweis</dt>
                        <dd>{room.detail}</dd>
                      </>
                    )}
                  </dl>
                  <MapLinks place={room} />
                </>
              ) : (
                <p className={s.pending}>Standort wird noch übermittelt</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
