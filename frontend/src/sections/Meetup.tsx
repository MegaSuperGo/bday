import { useRef } from 'react';
import { gsap } from '../animations/gsap';
import { useSectionMotion } from '../animations/useSectionMotion';
import { useBriefing } from '../app/BriefingContext';
import { MapLinks } from '../components/MapLinks';
import { MapView } from '../components/MapView';
import { SectionHeader } from '../components/SectionHeader';
import s from './shared.module.css';
import styles from './Meetup.module.css';

export function Meetup() {
  const { event } = useBriefing();
  const ref = useRef<HTMLElement>(null);
  const p = event.meeting;
  const hasCoords = p.lat !== null && p.lng !== null;

  useSectionMotion(ref, (root) => {
    const digits = root.querySelector('[data-time]');
    if (digits) {
      gsap.from(digits, {
        letterSpacing: '0.2em',
        autoAlpha: 0,
        duration: 1.4,
        ease: 'expo.out',
        scrollTrigger: { trigger: digits, start: 'top 80%', once: true },
      });
    }
  });

  return (
    <section ref={ref} data-section="meetup" className={s.section} aria-labelledby="meetup-title">
      <div className={s.inner}>
        <SectionHeader index="02" kicker="Mission 01 · Der Treffpunkt" status="Priorität: Pünktlichkeit" />
        <div className={styles.grid}>
          <div className={styles.text}>
            <span className={s.speaker} data-reveal>
              JARVIS
            </span>
            <p className={s.jarvis} data-reveal>
              {event.missions.meetup || 'Dein erster Auftrag: Erscheine pünktlich am vereinbarten Treffpunkt.'}
            </p>

            <div className={styles.time} data-time aria-label={`${event.startTime} Uhr`}>
              {event.startTime}
              <span className="mono">UHR</span>
            </div>
            <h2 id="meetup-title" className={styles.place} data-reveal>
              {p.name}
              <span>{p.city}</span>
            </h2>
            {p.address && (
              <p className={s.muted} data-reveal>
                {p.address}
              </p>
            )}
            {p.detail && (
              <p className={styles.detail} data-reveal>
                {p.detail}
              </p>
            )}
            <div data-reveal>
              <MapLinks place={p} />
            </div>
          </div>

          <div className={styles.mapCol} data-scan>
            {hasCoords ? (
              <MapView lat={p.lat!} lng={p.lng!} label="TREFFPUNKT" sublabel={p.name.toUpperCase()} />
            ) : (
              <div className={`${s.panel} ${styles.noMap}`}>
                <span className={s.pending}>Koordinaten noch nicht hinterlegt</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
