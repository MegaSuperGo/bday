import styles from './Reticle.module.css';

/** Technical targeting reticle (SVG). Purely presentational. */
export function Reticle({ scanning }: { scanning: boolean }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 400" className={`${styles.svg} ${scanning ? styles.scanning : ''}`} role="presentation">
      <defs>
        <linearGradient id="ret-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="var(--c-accent)" stopOpacity="0" />
          <stop offset="1" stopColor="var(--c-accent)" stopOpacity="0.35" />
        </linearGradient>
        <clipPath id="ret-clip">
          <circle cx="200" cy="200" r="150" />
        </clipPath>
      </defs>
      <g className={styles.ticks}>
        {ticks.map((i) => (
          <line
            key={i}
            x1="200"
            y1={i % 6 === 0 ? 14 : 20}
            x2="200"
            y2="28"
            transform={`rotate(${i * 5} 200 200)`}
            stroke="currentColor"
            strokeWidth={i % 6 === 0 ? 1.4 : 0.8}
          />
        ))}
      </g>
      <circle cx="200" cy="200" r="172" className={styles.thin} />
      <g className={styles.ringA}>
        <circle cx="200" cy="200" r="150" className={styles.dash} />
      </g>
      <g className={styles.ringB}>
        <path d="M200 90 A110 110 0 0 1 310 200" className={styles.arc} />
        <path d="M200 310 A110 110 0 0 1 90 200" className={styles.arc} />
      </g>
      <g clipPath="url(#ret-clip)">
        <rect x="50" y="196" width="300" height="8" className={styles.scanbar} fill="url(#ret-sweep)" />
      </g>
      <circle cx="200" cy="200" r="64" className={styles.thin} />
      <circle cx="200" cy="200" r="5" className={styles.core} />
      <path d="M200 120v40M200 240v40M120 200h40M240 200h40" className={styles.cross} />
    </svg>
  );
}
