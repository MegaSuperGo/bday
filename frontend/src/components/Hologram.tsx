import { forwardRef } from 'react';
import styles from './Hologram.module.css';

interface Props {
  labels: { top: string; right: string; bottom: string; left: string };
}

/**
 * Central JARVIS-style holographic interface. Layered SVG rings, each
 * animated on its own axis (CSS idle rotation + GSAP scroll scrub in Welcome).
 */
export const Hologram = forwardRef<SVGSVGElement, Props>(function Hologram({ labels }, ref) {
  const seg = (r: number, count: number, gap: number) => {
    const circ = 2 * Math.PI * r;
    const len = circ / count - gap;
    return `${len} ${gap}`;
  };
  return (
    <svg ref={ref} viewBox="0 0 600 600" className={styles.svg} role="img" aria-label="NEXUS Holo-Interface">
      <defs>
        <radialGradient id="holo-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="var(--c-accent)" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="var(--c-accent)" stopOpacity="0.08" />
          <stop offset="1" stopColor="var(--c-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="300" cy="300" r="120" fill="url(#holo-core)" className={styles.glow} />

      {/* outer graduated ring */}
      <g className={`${styles.ring} ${styles.r1}`} data-holo="r1">
        {Array.from({ length: 120 }, (_, i) => (
          <line
            key={i}
            x1="300"
            y1={i % 10 === 0 ? 18 : 26}
            x2="300"
            y2="34"
            transform={`rotate(${i * 3} 300 300)`}
            className={i % 10 === 0 ? styles.tickMajor : styles.tick}
          />
        ))}
      </g>
      <circle cx="300" cy="300" r="250" className={styles.hair} />

      <g className={`${styles.ring} ${styles.r2}`} data-holo="r2">
        <circle cx="300" cy="300" r="226" className={styles.segA} strokeDasharray={seg(226, 6, 28)} />
      </g>
      <g className={`${styles.ring} ${styles.r3}`} data-holo="r3">
        <circle cx="300" cy="300" r="196" className={styles.dots} />
        <path d="M300 104 A196 196 0 0 1 496 300" className={styles.arcBright} />
      </g>
      <g className={`${styles.ring} ${styles.r4}`} data-holo="r4">
        <circle cx="300" cy="300" r="164" className={styles.segB} strokeDasharray={seg(164, 24, 10)} />
      </g>
      <g className={`${styles.ring} ${styles.r5}`} data-holo="r5">
        <circle cx="300" cy="300" r="132" className={styles.hair} />
        <path d="M300 168 A132 132 0 0 1 432 300" className={styles.arcThick} />
        <path d="M300 432 A132 132 0 0 1 168 300" className={styles.arcThick} />
      </g>

      {/* core */}
      <g className={styles.core} data-holo="core">
        <circle cx="300" cy="300" r="74" className={styles.hair} />
        <circle cx="300" cy="300" r="52" className={styles.coreRing} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="300" y1="252" x2="300" y2="264" transform={`rotate(${i * 30} 300 300)`} className={styles.coreTick} />
        ))}
        <circle cx="300" cy="300" r="18" className={styles.coreDot} />
      </g>

      {/* crosshair + readouts */}
      <path d="M300 0v60M300 540v60M0 300h60M540 300h60" className={styles.hair} />
      <text x="300" y="80" className={styles.label} textAnchor="middle">{labels.top}</text>
      <text x="520" y="292" className={styles.label} textAnchor="end">{labels.right}</text>
      <text x="300" y="530" className={styles.label} textAnchor="middle">{labels.bottom}</text>
      <text x="80" y="292" className={styles.label}>{labels.left}</text>
    </svg>
  );
});
