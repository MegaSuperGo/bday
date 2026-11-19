import { Box } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ScrollTrigger } from '../animations/gsap';
import { useNearViewport, useVisible } from '../hooks/useInView';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { webglAvailable, type SceneFactory, type SceneHandle } from '../three/core';
import styles from './ThreeStage.module.css';

interface Props {
  /** dynamic import so three.js scenes are only downloaded when needed */
  load: () => Promise<SceneFactory>;
  /** element whose scroll progress drives the scene (defaults to the stage) */
  progressTrigger?: React.RefObject<HTMLElement | null>;
  label: string;
  className?: string;
  onEvent?: (name: string) => void;
  hint?: string;
  hintPosition?: 'top' | 'bottom';
}

export function ThreeStage({ load, progressTrigger, label, className, onEvent, hint, hintPosition = 'bottom' }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const near = useNearViewport(host, '600px');
  const visible = useVisible(host);
  const reduced = useReducedMotion();
  const handle = useRef<SceneHandle | null>(null);
  const activated = useRef(false);
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'unsupported' | 'error'>('idle');

  // Lazy-load and mount the scene
  useEffect(() => {
    if (!near || !host.current) return;
    if (!webglAvailable()) {
      setState('unsupported');
      return;
    }
    let cancelled = false;
    setState('loading');
    const mobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    load()
      .then((factory) => {
        if (cancelled || !host.current) return;
        handle.current = factory(host.current, { reducedMotion: reduced, mobile, onEvent: (n) => eventRef.current?.(n) });
        setState('ready');
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
      handle.current?.dispose();
      handle.current = null;
      activated.current = false;
    };
  }, [near, load, reduced]);

  // Pause rendering off-screen; activate on first reveal
  useEffect(() => {
    const h = handle.current;
    if (!h || state !== 'ready') return;
    h.setRunning(visible);
    if (visible && !activated.current) {
      activated.current = true;
      window.setTimeout(() => h.activate?.(), 350);
    }
  }, [visible, state]);

  // Feed scroll progress
  useEffect(() => {
    if (state !== 'ready') return;
    const trigger = progressTrigger?.current ?? host.current;
    if (!trigger) return;
    const st = ScrollTrigger.create({
      trigger,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => handle.current?.setProgress?.(self.progress),
    });
    handle.current?.setProgress?.(st.progress);
    return () => st.kill();
  }, [state, progressTrigger]);

  return (
    <div className={`${styles.stage} ${className ?? ''}`}>
      <div ref={host} className={styles.host} role="img" aria-label={label} />
      {state === 'loading' && <span className={`mono ${styles.status}`}>3D-Modell wird geladen</span>}
      {(state === 'unsupported' || state === 'error') && (
        <div className={styles.fallback}>
          <Box />
          <span className="mono">
            {state === 'unsupported' ? '3D-Darstellung auf diesem Gerät nicht verfügbar' : '3D-Darstellung konnte nicht geladen werden'}
          </span>
        </div>
      )}
      {hint && state === 'ready' && <span className={`mono ${styles.hint} ${hintPosition === 'top' ? styles.hintTop : ''}`}>{hint}</span>}
    </div>
  );
}
