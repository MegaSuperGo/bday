import { useEffect } from 'react';
import styles from './SystemNotice.module.css';

export interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'warn' | 'alert';
}

export function SystemNotice({ notice, onDone }: { notice: Notice | null; onDone: () => void }) {
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(onDone, 4200);
    return () => window.clearTimeout(t);
  }, [notice, onDone]);
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {notice && (
        <div key={notice.id} className={`${styles.notice} ${styles[notice.tone]}`}>
          <span className="mono">SYSTEM</span>
          <p>{notice.text}</p>
        </div>
      )}
    </div>
  );
}
