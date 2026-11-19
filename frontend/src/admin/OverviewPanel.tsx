import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { AdminGuest, AdminStats } from '../../../shared/types';
import { adminApi, fmtDate, relative, STATUS_LABEL } from './api';
import styles from './admin.module.css';

export function OverviewPanel({ onAuthError }: { onAuthError: (e: unknown) => void }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [guests, setGuests] = useState<AdminGuest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, g] = await Promise.all([adminApi.get<AdminStats>('/stats'), adminApi.get<{ guests: AdminGuest[] }>('/guests')]);
      setStats(s);
      setGuests(g.guests);
      setError(null);
      setUpdated(new Date());
    } catch (e) {
      onAuthError(e);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onAuthError]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const tiles: [string, number | undefined, string?][] = [
    ['Eingeladene Gäste', stats?.totalGuests],
    ['Briefing abgeschlossen', stats?.completed, 'ok'],
    ['In Bearbeitung', stats?.inProgress, 'accent'],
    ['Nicht gestartet', stats?.notStarted, 'warn'],
    ['Chat-Nachrichten', stats?.chatMessagesTotal],
  ];

  return (
    <section>
      <header className={styles.panelHead}>
        <div>
          <p className={`mono ${styles.dim}`}>Lagebild</p>
          <h1 className={styles.h1}>Übersicht</h1>
        </div>
        <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw /> Aktualisieren
        </button>
      </header>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.tiles}>
        {tiles.map(([label, value, tone]) => (
          <div key={label} className={styles.tile}>
            <span className={`mono ${styles.dim}`}>{label}</span>
            <span className={`${styles.tileValue} ${tone ? styles[tone] : ''}`}>{value ?? '–'}</span>
          </div>
        ))}
      </div>

      <h2 className={styles.h2}>Gästeaktivität</h2>
      {guests.length === 0 ? (
        <p className={styles.empty}>Noch keine Gäste erfasst. Lege sie im Bereich «Gäste» an.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Gast</th>
                <th>Status</th>
                <th>Fortschritt</th>
                <th>Letzte Aktivität</th>
                <th>Gestartet</th>
                <th>Abgeschlossen</th>
                <th>Chat</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.id}>
                  <td className={styles.strong}>{g.firstName}</td>
                  <td>
                    <span className={`${styles.badge} ${styles['b_' + g.status]}`}>{STATUS_LABEL[g.status]}</span>
                  </td>
                  <td>
                    <div className={styles.progress} aria-label={`${g.progress} Prozent`}>
                      <span style={{ width: `${g.progress}%` }} />
                    </div>
                    <span className={`mono ${styles.dim}`}>{g.progress}%</span>
                  </td>
                  <td>{relative(g.lastActivityAt)}</td>
                  <td>{fmtDate(g.startedAt)}</td>
                  <td>{fmtDate(g.completedAt)}</td>
                  <td className="mono">{g.chatMessages}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {updated && <p className={`mono ${styles.dim} ${styles.updated}`}>Stand {updated.toLocaleTimeString('de-CH')} · automatische Aktualisierung alle 30 s</p>}
    </section>
  );
}
