import { RefreshCw, ServerOff, Settings2 } from 'lucide-react';
import styles from './SetupState.module.css';

interface Props {
  kind: 'unconfigured' | 'offline';
  message?: string;
  onRetry?: () => void;
}

/** Honest status screen when the backend is missing or unreachable. */
export function SetupState({ kind, message, onRetry }: Props) {
  return (
    <main className={styles.wrap}>
      <div className={`${styles.panel} brackets`}>
        <p className="mono">NEXUS INTELLIGENCE SYSTEM</p>
        <div className={styles.icon}>{kind === 'unconfigured' ? <Settings2 /> : <ServerOff />}</div>
        {kind === 'unconfigured' ? (
          <>
            <h1 className={styles.title}>System nicht konfiguriert</h1>
            <p className={styles.text}>
              Diese Version wurde ohne Backend-Verbindung erstellt. Die Variable <code>VITE_API_URL</code> muss beim Build auf
              die Adresse des Cloudflare Workers zeigen. Details stehen in der README unter «Frontend-API-URL».
            </p>
          </>
        ) : (
          <>
            <h1 className={styles.title}>Verbindung unterbrochen</h1>
            <p className={styles.text}>Der NEXUS-Server ist momentan nicht erreichbar. {message}</p>
            <button className="btn" onClick={onRetry}>
              <RefreshCw /> Erneut verbinden
            </button>
          </>
        )}
      </div>
    </main>
  );
}
