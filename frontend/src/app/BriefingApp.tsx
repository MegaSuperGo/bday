import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BriefingPayload, GuestPublic, IdentifyResponse } from '../../../shared/types';
import { Hud } from '../components/Hud';
import { ProgressRail } from '../components/ProgressRail';
import { SetupState } from '../components/SetupState';
import { SystemNotice, type Notice } from '../components/SystemNotice';
import { useKonami } from '../hooks/useKonami';
import { Identification } from '../sections/Identification';
import { API_CONFIGURED, apiFetch, ApiRequestError } from '../services/api';
import { guestToken } from '../services/session';
import { BriefingContext, type BriefingState } from './BriefingContext';
import { useBriefingTracker } from './useBriefingTracker';
import styles from './BriefingApp.module.css';

const Briefing = lazy(() => import('./Briefing'));
const JarvisAssistant = lazy(() => import('../components/jarvis/JarvisAssistant'));

type Phase =
  | { name: 'boot' }
  | { name: 'unconfigured' }
  | { name: 'offline'; message: string }
  | { name: 'identify' }
  | { name: 'briefing'; data: BriefingPayload; token: string };

export function BriefingApp() {
  const [phase, setPhase] = useState<Phase>(() => (API_CONFIGURED ? { name: 'boot' } : { name: 'unconfigured' }));
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeId = useRef(0);

  const notify = useCallback((text: string, tone: Notice['tone'] = 'info') => {
    setNotice({ id: ++noticeId.current, text, tone });
  }, []);

  // Restore an existing device session
  const resume = useCallback(async () => {
    const token = guestToken.get();
    if (!token) return setPhase({ name: 'identify' });
    try {
      const data = await apiFetch<BriefingPayload>('/api/briefing', { token });
      setPhase({ name: 'briefing', data, token });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        guestToken.clear();
        setPhase({ name: 'identify' });
      } else {
        setPhase({ name: 'offline', message: (e as Error).message });
      }
    }
  }, []);

  useEffect(() => {
    if (phase.name === 'boot') void resume();
  }, [phase.name, resume]);

  const onIdentified = useCallback((res: IdentifyResponse) => {
    guestToken.set(res.token);
    const { token, ...data } = res;
    window.scrollTo(0, 0);
    setPhase({ name: 'briefing', data, token });
  }, []);

  const setGuest = useCallback((guest: GuestPublic) => {
    setPhase((p) => (p.name === 'briefing' ? { ...p, data: { ...p.data, guest } } : p));
  }, []);

  const logout = useCallback(() => {
    guestToken.clear();
    window.scrollTo(0, 0);
    setPhase({ name: 'identify' });
  }, []);

  const ctx = useMemo<BriefingState | null>(() => {
    if (phase.name !== 'briefing') return null;
    return {
      token: phase.token,
      guest: phase.data.guest,
      event: phase.data.event,
      chatAvailable: phase.data.chat.available,
      setGuest,
      notify,
      logout,
    };
  }, [phase, setGuest, notify, logout]);

  // Easter egg: Konami code toggles the "Mark II" blueprint palette
  useKonami(() => {
    const on = document.documentElement.classList.toggle('mark-ii');
    notify(on ? 'Protokoll MARK II aktiviert. Blaupausen-Modus.' : 'Protokoll MARK II deaktiviert.', 'info');
  });

  if (phase.name === 'unconfigured') return <SetupState kind="unconfigured" />;
  if (phase.name === 'offline') return <SetupState kind="offline" message={phase.message} onRetry={() => setPhase({ name: 'boot' })} />;

  return (
    <>
      {phase.name === 'boot' && <div className={styles.boot} aria-busy="true" aria-label="Verbindung wird aufgebaut" />}
      {phase.name === 'identify' && <Identification onIdentified={onIdentified} />}
      {ctx && (
        <BriefingContext.Provider value={ctx}>
          <BriefingShell />
        </BriefingContext.Provider>
      )}
      <SystemNotice notice={notice} onDone={() => setNotice(null)} />
    </>
  );
}

function BriefingShell() {
  const tracker = useBriefingTracker();
  return (
    <div className={styles.shell}>
      <Hud active={tracker.active} progress={tracker.progress} />
      <ProgressRail active={tracker.active} reached={tracker.reached} />
      <Suspense fallback={<div className={styles.boot} />}>
        <Briefing rootRef={tracker.attach} completion={tracker.completion} />
        <JarvisAssistant />
      </Suspense>
    </div>
  );
}
