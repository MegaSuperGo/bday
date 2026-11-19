import { Check, RotateCw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatGermanDate } from '../../../shared/time';
import { useSectionMotion } from '../animations/useSectionMotion';
import type { Completion } from '../app/useBriefingTracker';
import { useBriefing } from '../app/BriefingContext';
import { SectionHeader } from '../components/SectionHeader';
import { sound } from '../services/sound';
import s from './shared.module.css';
import styles from './Summary.module.css';

export function Summary({ completion }: { completion: Completion }) {
  const { event, guest } = useBriefing();
  const ref = useRef<HTMLElement>(null);
  useSectionMotion(ref);
  const done = completion.state === 'done';

  useEffect(() => {
    if (done) sound.play('confirm');
  }, [done]);

  const missionId = `OP-BDAY-${event.date.replace(/-/g, '')}`;
  const meeting = [event.meeting.name, event.meeting.city].filter(Boolean).join(', ');
  const rows: [string, React.ReactNode][] = [
    ['Datum', formatGermanDate(event.date)],
    ['Zeit', `${event.startTime} Uhr`],
    ['Treffpunkt', event.meeting.detail ? `${meeting}\n${event.meeting.detail}` : meeting],
    ['Erste Aktivität', event.escapeRoom.name ? `Escape Room · ${event.escapeRoom.name}` : 'Escape Room'],
    ['Finales Ziel', [event.restaurant.name, event.restaurant.city].filter(Boolean).join(', ')],
  ];
  if (event.endTime) rows.push(['Ende', `ca. ${event.endTime} Uhr`]);
  if (event.additionalInstructions) rows.push(['Hinweise', event.additionalInstructions]);

  return (
    <section ref={ref} data-section="summary" className={s.section} aria-labelledby="summary-title">
      <div className={s.inner}>
        <SectionHeader index="05" kicker="Secure Dossier" status={`Empfänger: ${guest.firstName}`} />
        <div className={styles.grid}>
          <div className={styles.intro}>
            <h2 id="summary-title" className={s.h2} data-reveal>
              Das Wichtigste
              <br />
              <span className={s.muted}>auf einen Blick.</span>
            </h2>
            <span className={s.speaker} data-reveal>
              JARVIS
            </span>
            <p className={s.jarvis} data-reveal>
              Das Briefing ist nahezu abgeschlossen. Alle relevanten Informationen wurden bereitgestellt.
            </p>
          </div>

          <article className={`${s.panel} brackets ${styles.dossier}`} data-scan>
            <header className={styles.head}>
              <span className="mono">Dossier {missionId}</span>
              <span className={`mono ${styles.stamp}`}>Vertraulich</span>
            </header>
            <dl className={styles.rows}>
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <footer className={styles.status} aria-live="polite">
              <StatusLine label="MISSION DATA" value="TRANSMITTED" on={done} delay={0} />
              <StatusLine label="BRIEFING" value="COMPLETED" on={done} delay={0.35} />
              {completion.state === 'error' && (
                <button type="button" className="btn" onClick={completion.retry}>
                  <RotateCw /> Status erneut übertragen
                </button>
              )}
            </footer>
          </article>
        </div>

        <div className={`${styles.readiness} ${done ? styles.ready : ''}`} data-reveal>
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" className={styles.track} />
            <circle cx="60" cy="60" r="52" className={styles.fill} pathLength={100} />
          </svg>
          <div>
            <span className={`mono ${s.muted}`}>Einsatzbereitschaft</span>
            <p className={styles.readyText}>
              {done ? `${guest.firstName} ist vollständig informiert.` : completion.state === 'sending' ? 'Status wird übertragen …' : 'Bitte Dossier prüfen.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusLine({ label, value, on, delay }: { label: string; value: string; on: boolean; delay: number }) {
  return (
    <div className={`${styles.line} ${on ? styles.lineOn : ''}`} style={{ transitionDelay: `${delay}s` }}>
      <span className="mono">{label}:</span>
      <span className={`mono ${styles.value}`}>
        {on ? (
          <>
            <Check /> {value}
          </>
        ) : (
          'AUSSTEHEND'
        )}
      </span>
    </div>
  );
}
