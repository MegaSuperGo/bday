import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import type { OrbHandle, OrbMood } from '../../three/orbScene';
import { webglAvailable } from '../../three/core';
import styles from './Jarvis.module.css';

/** WebGL orb with a CSS fallback for devices without WebGL. */
export function OrbCanvas({ mood, running }: { mood: OrbMood; running: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const orb = useRef<OrbHandle | null>(null);
  const reduced = useReducedMotion();
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    if (!webglAvailable()) {
      setFallback(true);
      return;
    }
    let cancelled = false;
    import('../../three/orbScene')
      .then(({ createOrb }) => {
        if (cancelled || !host.current) return;
        orb.current = createOrb(host.current, { reducedMotion: reduced });
        orb.current.setRunning(true);
      })
      .catch(() => setFallback(true));
    return () => {
      cancelled = true;
      orb.current?.dispose();
      orb.current = null;
    };
  }, [reduced]);

  useEffect(() => orb.current?.setMood(mood), [mood]);
  useEffect(() => orb.current?.setRunning(running), [running]);

  return (
    <div className={styles.orbVisual} aria-hidden>
      <div ref={host} className={styles.orbCanvas} />
      {fallback && <div className={`${styles.cssOrb} ${styles[mood]}`} />}
    </div>
  );
}
