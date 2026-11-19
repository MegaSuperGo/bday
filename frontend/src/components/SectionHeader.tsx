import styles from './SectionHeader.module.css';

interface Props {
  index: string;
  kicker: string;
  status?: string;
}

/** Technical header strip used at the top of every briefing section. */
export function SectionHeader({ index, kicker, status }: Props) {
  return (
    <div className={styles.header} data-reveal>
      <span className={`mono ${styles.index}`}>{index}</span>
      <span className={`mono ${styles.kicker}`}>{kicker}</span>
      <span className={styles.line} aria-hidden />
      {status && <span className={`mono ${styles.status}`}>{status}</span>}
    </div>
  );
}
