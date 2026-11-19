import { useEffect, useState } from 'react';
import { countdownParts, type CountdownParts } from '../../../shared/time';

/** Ticks exactly on the second boundary so all digits change together. */
export function useCountdown(target: Date): CountdownParts {
  const [parts, setParts] = useState(() => countdownParts(target));
  useEffect(() => {
    let timer: number;
    const tick = () => {
      const p = countdownParts(target);
      setParts(p);
      if (!p.started) timer = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, [target]);
  return parts;
}
