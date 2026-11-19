import { Bot, CalendarCog, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SetupState } from '../components/SetupState';
import { API_CONFIGURED, ApiRequestError } from '../services/api';
import { AiPanel } from './AiPanel';
import { adminApi } from './api';
import { EventPanel } from './EventPanel';
import { GuestsPanel } from './GuestsPanel';
import { Login } from './Login';
import { OverviewPanel } from './OverviewPanel';
import styles from './admin.module.css';

type Tab = 'overview' | 'guests' | 'event' | 'ai';
const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Übersicht', icon: LayoutDashboard },
  { id: 'guests', label: 'Gäste', icon: Users },
  { id: 'event', label: 'Event', icon: CalendarCog },
  { id: 'ai', label: 'JARVIS / Groq', icon: Bot },
];

export function AdminApp() {
  const [auth, setAuth] = useState<'checking' | 'out' | 'in' | 'offline'>('checking');
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || 'overview');

  const check = useCallback(async () => {
    try {
      await adminApi.get('/session');
      setAuth('in');
    } catch (e) {
      setAuth(e instanceof ApiRequestError && e.status === 401 ? 'out' : 'offline');
    }
  }, []);

  useEffect(() => {
    if (API_CONFIGURED) void check();
  }, [check]);

  useEffect(() => {
    history.replaceState(null, '', `#${tab}`);
  }, [tab]);

  /** Any 401 from a panel sends the admin back to the login screen. */
  const onAuthError = useCallback((e: unknown) => {
    if (e instanceof ApiRequestError && e.status === 401) setAuth('out');
  }, []);

  if (!API_CONFIGURED) return <SetupState kind="unconfigured" />;
  if (auth === 'offline') return <SetupState kind="offline" onRetry={() => void check()} />;
  if (auth === 'checking') return <div className={styles.loading} />;
  if (auth === 'out') return <Login onSuccess={() => setAuth('in')} />;

  const logout = async () => {
    try {
      await adminApi.post('/logout');
    } finally {
      setAuth('out');
    }
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.side}>
        <div className={styles.brand}>
          <span className={styles.glyph} aria-hidden />
          <div>
            <p className="mono">NEXUS</p>
            <p className={`mono ${styles.dim}`}>Mission Control</p>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Bereiche">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? styles.navActive : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
              <t.icon /> <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <button type="button" className={styles.logout} onClick={() => void logout()}>
          <LogOut /> <span>Abmelden</span>
        </button>
      </aside>
      <main className={styles.main}>
        {tab === 'overview' && <OverviewPanel onAuthError={onAuthError} />}
        {tab === 'guests' && <GuestsPanel onAuthError={onAuthError} />}
        {tab === 'event' && <EventPanel onAuthError={onAuthError} />}
        {tab === 'ai' && <AiPanel onAuthError={onAuthError} />}
      </main>
    </div>
  );
}
