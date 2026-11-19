import { ArrowDown } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { BRIEFING_SECTIONS } from '../../../shared/types';
import { gsap } from '../animations/gsap';
import { useSectionMotion } from '../animations/useSectionMotion';
import { useBriefing } from '../app/BriefingContext';
import { SectionHeader } from '../components/SectionHeader';
import { sound } from '../services/sound';
import { missionsFrom } from './missions';
import s from './shared.module.css';
import styles from './Overview.module.css';

export function Overview() {
  const { event, guest } = useBriefing();
  const ref = useRef<HTMLElement>(null);
  const missions = useMemo(() => missionsFrom(event), [event]);
  const [selected, setSelected] = useState(0);
  const furthest = guest.furthestSection ? BRIEFING_SECTIONS.indexOf(guest.furthestSection) : -1;

  useSectionMotion(ref, (root) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: root.querySelector('[data-route]'), start: 'top 75%', once: true } });
    tl.from(root.querySelector('[data-route-line]'), { scaleX: 0, transformOrigin: 'left', duration: 1.4, ease: 'power2.inOut' })
      .from(root.querySelectorAll('[data-node]'), { autoAlpha: 0, scale: 0.6, stagger: 0.25, duration: 0.6, ease: 'back.out(2)' }, 0.2)
      .from(root.querySelector('[data-detail]'), { autoAlpha: 0, y: 20 }, 0.9);
  });

  const m = missions[selected];
  const statusOf = (i: number) => (furthest >= BRIEFING_SECTIONS.indexOf(missions[i].section) ? 'GESICHTET' : 'AUSSTEHEND');

  const jump = () =>
    document.querySelector(`[data-section="${m.section}"]`)?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });

  return (
    <section ref={ref} data-section="overview" className={s.section} aria-labelledby="overview-title">
      <div className={s.inner}>
        <SectionHeader index="01" kicker="Missionsübersicht" status={`${missions.length} Ziele erfasst`} />
        <div className={styles.head}>
          <h2 id="overview-title" className={s.h2} data-reveal>
            Drei Ziele.
            <br />
            <span className={s.muted}>Eine Operation.</span>
          </h2>
          <p className={s.jarvis} data-reveal>
            Die Operation besteht aus drei aufeinanderfolgenden Missionszielen. Wähle ein Ziel, um die Eckdaten abzurufen.
          </p>
        </div>

        <div className={styles.route} data-route>
          <div className={styles.line} data-route-line aria-hidden>
            <span className={styles.signal} />
          </div>
          <div className={styles.nodes} role="tablist" aria-label="Missionsziele">
            {missions.map((mi, i) => (
              <button
                key={mi.no}
                type="button"
                role="tab"
                id={`mission-tab-${i}`}
                aria-selected={selected === i}
                aria-controls="mission-detail"
                className={`${styles.node} ${selected === i ? styles.selected : ''}`}
                onClick={() => {
                  setSelected(i);
                  sound.play('tick');
                }}
                data-node
              >
                <span className={styles.marker} aria-hidden>
                  <span />
                </span>
                <span className={`mono ${styles.no}`}>MISSION {mi.no}</span>
                <span className={styles.nodeTitle}>{mi.title}</span>
                <span className={`mono ${styles.nodeMeta}`}>
                  {mi.time ? `${mi.time} UHR` : 'ZEIT FOLGT'} · <em className={statusOf(i) === 'GESICHTET' ? styles.seen : ''}>{statusOf(i)}</em>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div id="mission-detail" role="tabpanel" aria-labelledby={`mission-tab-${selected}`} className={`${s.panel} brackets ${styles.detail}`} data-detail>
          <div key={selected} className={styles.detailInner}>
            <div className={styles.detailHead}>
              <span className="mono">MISSION {m.no}</span>
              <span className={`mono ${s.muted}`}>{m.code}</span>
            </div>
            <dl className={s.kv}>
              <dt>Zeit</dt>
              <dd>{m.time ? `${m.time} Uhr` : <span className={s.pending}>Wird noch bekanntgegeben</span>}</dd>
              <dt>Ort</dt>
              <dd>{m.placeLabel ?? <span className={s.pending}>Standort wird noch übermittelt</span>}</dd>
              {m.description && (
                <>
                  <dt>Auftrag</dt>
                  <dd>{m.description}</dd>
                </>
              )}
            </dl>
            <button type="button" className="btn" onClick={jump}>
              Zum Detail-Briefing <ArrowDown />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
