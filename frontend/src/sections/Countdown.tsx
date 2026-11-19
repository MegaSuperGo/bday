import { CalendarPlus, Download, ExternalLink, LogOut } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { formatGermanDate, zonedToUtc } from '../../../shared/time';
import { useSectionMotion } from '../animations/useSectionMotion';
import { useBriefing } from '../app/BriefingContext';
import { SectionHeader } from '../components/SectionHeader';
import { useCountdown } from '../hooks/useCountdown';
import { buildCalendarEvent, downloadIcs, googleCalendarUrl, outlookCalendarUrl } from '../services/calendar';
import { sound } from '../services/sound';
import s from './shared.module.css';
import styles from './Countdown.module.css';

export function Countdown() {
  const { event, guest, logout } = useBriefing();
  const ref = useRef<HTMLElement>(null);
  useSectionMotion(ref);

  const target = useMemo(() => zonedToUtc(event.date, event.startTime, event.timezone), [event.date, event.startTime, event.timezone]);
  const end = useMemo(() => (event.endTime ? zonedToUtc(event.date, event.endTime, event.timezone) : null), [event]);
  const cd = useCountdown(target);
  const cal = useMemo(() => buildCalendarEvent(event), [event]);
  const tzName = useMemo(
    () =>
      new Intl.DateTimeFormat('de-CH', { timeZone: event.timezone, timeZoneName: 'short' })
        .formatToParts(target)
        .find((p) => p.type === 'timeZoneName')?.value ?? '',
    [target, event.timezone],
  );

  const ended = end !== null && Date.now() > end.getTime();
  const units: [number, string][] = [
    [cd.days, 'Tage'],
    [cd.hours, 'Stunden'],
    [cd.minutes, 'Minuten'],
    [cd.seconds, 'Sekunden'],
  ];

  return (
    <section ref={ref} data-section="countdown" className={`${s.section} ${styles.countdown}`} aria-labelledby="cd-title">
      <div className={s.inner}>
        <SectionHeader index="06" kicker="Countdown" status={`${event.timezone} · ${tzName}`} />
        <h2 id="cd-title" className={`mono ${styles.title}`} data-reveal>
          Time until mission
        </h2>

        {cd.started ? (
          <div className={styles.live} data-reveal role="status">
            <span className={styles.liveDot} aria-hidden />
            <p>{ended ? 'Mission abgeschlossen. Danke, dass du dabei warst.' : 'Die Mission hat begonnen. Begib dich zum Treffpunkt.'}</p>
          </div>
        ) : (
          <div className={styles.clock} data-reveal role="timer" aria-label={`Noch ${cd.days} Tage, ${cd.hours} Stunden, ${cd.minutes} Minuten`}>
            {units.map(([v, l], i) => (
              <div key={l} className={styles.unit}>
                <span className={styles.value} aria-hidden>
                  {String(v).padStart(2, '0')}
                </span>
                <span className={`mono ${styles.label}`} aria-hidden>
                  {l}
                </span>
                {i < units.length - 1 && <span className={styles.sep} aria-hidden />}
              </div>
            ))}
          </div>
        )}
        <p className={`mono ${styles.target}`} data-reveal>
          Einsatzbeginn · {formatGermanDate(event.date)} · {event.startTime} Uhr {tzName}
        </p>

        <div className={styles.calendar} data-reveal>
          <div className={styles.calHead}>
            <CalendarPlus />
            <div>
              <p className={styles.calTitle}>In den Kalender eintragen</p>
              <p className={`mono ${s.muted}`}>
                {cal.meetupOnly ? `Eintrag: Treffpunkt ${event.startTime} Uhr · Endzeit noch offen` : `${event.startTime}–${event.endTime} Uhr`}
              </p>
            </div>
          </div>
          <div className={styles.calButtons}>
            <button
              type="button"
              className={styles.calBtn}
              onClick={() => {
                downloadIcs(cal);
                sound.play('confirm');
              }}
            >
              <span className="mono">Apple Kalender</span>
              <span className={styles.calSub}>
                .ics-Datei <Download />
              </span>
            </button>
            <a className={styles.calBtn} href={googleCalendarUrl(cal)} target="_blank" rel="noreferrer">
              <span className="mono">Google Kalender</span>
              <span className={styles.calSub}>
                Im Browser öffnen <ExternalLink />
              </span>
            </a>
            <a className={styles.calBtn} href={outlookCalendarUrl(cal)} target="_blank" rel="noreferrer">
              <span className="mono">Outlook</span>
              <span className={styles.calSub}>
                Im Browser öffnen <ExternalLink />
              </span>
            </a>
          </div>
        </div>
      </div>

      <footer className={`${s.inner} ${styles.footer}`}>
        <span className="mono">Ende der Übertragung</span>
        <button type="button" className={`mono ${styles.switch}`} onClick={logout}>
          <LogOut /> Nicht {guest.firstName}? Abmelden
        </button>
      </footer>
    </section>
  );
}
