import { useEffect, useRef } from 'react';

const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function useKonami(onUnlock: () => void) {
  const pos = useRef(0);
  const cb = useRef(onUnlock);
  cb.current = onUnlock;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos.current = key === SEQ[pos.current] ? pos.current + 1 : key === SEQ[0] ? 1 : 0;
      if (pos.current === SEQ.length) {
        pos.current = 0;
        cb.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
