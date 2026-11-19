import { ArrowRight, Check } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import type { IdentifyResponse } from '../../../shared/types';
import { gsap, MOTION_OK } from '../animations/gsap';
import { Reticle } from '../components/Reticle';
import { prefersReducedMotion } from '../hooks/useReducedMotion';
import { useZurichClock } from '../hooks/useZurichClock';
import { apiFetch, ApiRequestError } from '../services/api';
import { sound } from '../services/sound';
import styles from './Identification.module.css';

const SCAN_LINES = ['Gastidentität erkannt.', 'Zugriff autorisiert.', 'Missionsdaten werden geladen.'];

export function Identification({ onIdentified }: { onIdentified: (r: IdentifyResponse) => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<{ res: IdentifyResponse; step: number } | null>(null);
  const root = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const clock = useZurichClock();

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap
        .timeline({ delay: 0.15 })
        .from('[data-intro]', { y: 18, autoAlpha: 0, stagger: 0.09, duration: 0.9 })
        .from('[data-intro-line]', { scaleX: 0, transformOrigin: 'left', duration: 1.1, ease: 'power3.inOut' }, 0.2);
    }, root);
    input.current?.focus({ preventScroll: true });
    return () => mm.revert();
  }, []);

  // Verification sequence – runs only after the server confirmed the identity
  useEffect(() => {
    if (!scan) return;
    const fast = prefersReducedMotion();
    if (scan.step < SCAN_LINES.length) {
      const t = window.setTimeout(() => {
        sound.play('tick');
        setScan((s) => (s ? { ...s, step: s.step + 1 } : s));
      }, fast ? 120 : scan.step === 0 ? 350 : 480);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      sound.play('confirm');
      onIdentified(scan.res);
    }, fast ? 150 : 650);
    return () => window.clearTimeout(t);
  }, [scan, onIdentified]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const firstName = name.trim();
    if (!firstName || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<IdentifyResponse>('/api/identify', { method: 'POST', body: { firstName } });
      setScan({ res, step: 0 });
    } catch (err) {
      sound.play('alert');
      if (err instanceof ApiRequestError && err.code === 'UNKNOWN_GUEST') {
        setError('Identität nicht erkannt. Prüfe die Schreibweise deines Vornamens.');
      } else {
        setError((err as Error).message);
      }
      setBusy(false);
      input.current?.focus();
    }
  };

  return (
    <main ref={root} className={styles.screen}>
      <header className={styles.top}>
        <span className="mono" data-intro>
          NEXUS INTELLIGENCE SYSTEM
        </span>
        <span className={`mono ${styles.clock}`} data-intro>
          LUZERN {clock}
        </span>
      </header>
      <div className={styles.rule} data-intro-line />

      <div className={styles.body}>
        <div className={styles.reticle} aria-hidden data-intro>
          <Reticle scanning={!!scan || busy} />
        </div>

        <div className={styles.content}>
          <p className={`mono ${styles.transmission}`} data-intro>
            <span className={styles.pulse} aria-hidden /> INCOMING TRANSMISSION
          </p>
          <h1 className={styles.title} data-intro>
            Bitte identifiziere dich, um deine Missions&shy;informationen abzurufen.
          </h1>

          {!scan ? (
            <form className={styles.form} onSubmit={submit} data-intro noValidate>
              <label htmlFor="firstName" className={`mono ${styles.label}`}>
                Vorname
              </label>
              <div className={styles.row}>
                <input
                  ref={input}
                  id="firstName"
                  name="firstName"
                  className={styles.input}
                  placeholder="Vorname eingeben"
                  autoComplete="given-name"
                  autoCapitalize="words"
                  spellCheck={false}
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'id-error' : undefined}
                  disabled={busy}
                />
                <button type="submit" className={`btn btn--primary ${styles.submit}`} disabled={busy || !name.trim()}>
                  {busy ? 'Analyse läuft' : 'Identifizieren'}
                  <ArrowRight />
                </button>
              </div>
              <p id="id-error" className={styles.error} role="alert">
                {error}
              </p>
            </form>
          ) : (
            <ol className={styles.scan} aria-live="polite">
              {SCAN_LINES.map((line, i) => (
                <li key={line} className={i < scan.step ? styles.done : i === scan.step ? styles.current : styles.waiting}>
                  <span className={styles.check}>{i < scan.step ? <Check /> : null}</span>
                  <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                  {line}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <footer className={`mono ${styles.foot}`} data-intro>
        <span>Verschlüsselte Verbindung</span>
        <span>Zugriff nur für eingeladene Gäste</span>
      </footer>
    </main>
  );
}
