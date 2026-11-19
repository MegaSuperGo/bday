import { useRef } from 'react';
import { formatGermanDate } from '../../../shared/time';
import { gsap } from '../animations/gsap';
import { useSectionMotion } from '../animations/useSectionMotion';
import { useBriefing } from '../app/BriefingContext';
import { Hologram } from '../components/Hologram';
import { formatCoord } from '../services/maps';
import s from './shared.module.css';
import styles from './Welcome.module.css';

export function Welcome() {
  const { guest, event } = useBriefing();
  const ref = useRef<HTMLElement>(null);
  const holo = useRef<SVGSVGElement>(null);

  useSectionMotion(ref, (root) => {
    // Intro: greeting resolves character by character
    const chars = root.querySelectorAll('[data-char]');
    gsap
      .timeline({ delay: 0.2 })
      .from(holo.current, { scale: 0.82, autoAlpha: 0, duration: 1.6, ease: 'expo.out' })
      .from(chars, { autoAlpha: 0, y: '0.3em', stagger: 0.035, duration: 0.6 }, 0.3)
      .from('[data-intro]', { autoAlpha: 0, y: 20, stagger: 0.12 }, 0.8);
    // Scroll: hologram drifts and the rings counter-rotate
    gsap.to(holo.current, {
      yPercent: 18,
      scale: 0.86,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to(root.querySelectorAll('[data-holo="r2"], [data-holo="r4"]'), {
      rotate: 90,
      ease: 'none',
      scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true },
    });
  });

  const greeting = `Hallo, ${guest.firstName}.`;
  const status = guest.status === 'COMPLETED' ? 'BRIEFING ABGESCHLOSSEN' : 'BRIEFING AUSSTEHEND';
  const coords = event.meeting.lat !== null && event.meeting.lng !== null ? formatCoord(event.meeting.lat, event.meeting.lng) : 'LUZERN';
  const [y, m, d] = event.date.split('-');

  return (
    <section ref={ref} data-section="welcome" className={`${s.section} ${styles.welcome}`} aria-labelledby="welcome-title">
      <div className={`${s.inner} ${styles.grid}`}>
        <div className={styles.text}>
          <p className={`mono ${styles.kicker}`} data-intro>
            Übertragung für {guest.firstName}
          </p>
          <h1 id="welcome-title" className={styles.h1} aria-label={greeting}>
            {greeting.split(' ').map((word, w, words) => (
              <span key={w} className={styles.word} aria-hidden>
                {[...word].map((c, i) => (
                  <span key={i} data-char>
                    {c}
                  </span>
                ))}
                {w < words.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
          <p className={styles.sub} data-intro>
            Ich habe eine wichtige Mission für dich vorbereitet.
          </p>
        </div>
        <div className={styles.holo}>
          <Hologram
            ref={holo}
            labels={{ top: `${d}.${m}.${y}`, right: `${event.startTime}`, bottom: coords, left: 'NEXUS' }}
          />
        </div>
      </div>

      <div className={`${s.inner} ${styles.lower}`}>
        <dl className={styles.status} data-intro>
          <div>
            <dt>Operation</dt>
            <dd>{event.title.replace(/^OPERATION:\s*/i, '')}</dd>
          </div>
          <div>
            <dt>Klassifizierung</dt>
            <dd>Vertraulich</dd>
          </div>
          <div>
            <dt>Standort</dt>
            <dd>{event.meeting.city || 'Luzern'}</dd>
          </div>
          <div>
            <dt>Missionsstatus</dt>
            <dd className={guest.status === 'COMPLETED' ? styles.ok : styles.wait}>{status}</dd>
          </div>
        </dl>

        <div className={styles.explain} data-reveal>
          <span className={s.speaker}>JARVIS</span>
          <p className={s.jarvis}>
            Du wurdest für eine besondere Mission am {formatGermanDate(event.date).replace(/^\w+, /, '')} ausgewählt. Ich werde dich nun
            über sämtliche wichtigen Details informieren. Bitte achte auf die folgenden Informationen.
          </p>
        </div>
      </div>
      <div className={`mono ${styles.cue}`} aria-hidden>
        <span />
        Scrollen
      </div>
    </section>
  );
}
