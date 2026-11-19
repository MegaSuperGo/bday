import { useCallback, useEffect, useRef, useState } from 'react';
import { BRIEFING_SECTIONS, type BriefingSection, type GuestPublic } from '../../../shared/types';
import { apiFetch } from '../services/api';
import { useBriefing } from './BriefingContext';

export type CompletionState = 'pending' | 'sending' | 'done' | 'error';

export interface Completion {
  state: CompletionState;
  retry: () => void;
}

const idx = (s: BriefingSection | null) => (s ? BRIEFING_SECTIONS.indexOf(s) : -1);

/**
 * Tracks which section the guest is reading, overall scroll progress and
 * persists real progress to the backend. The briefing is only marked as
 * completed once the summary section has actually been on screen.
 */
export function useBriefingTracker() {
  const { token, guest, setGuest } = useBriefing();
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState<BriefingSection>('welcome');
  const [progress, setProgress] = useState(0);
  const [reached, setReached] = useState<number>(idx(guest.furthestSection));
  const [completionState, setCompletionState] = useState<CompletionState>(guest.status === 'COMPLETED' ? 'done' : 'pending');
  const furthestSent = useRef(idx(guest.furthestSection));
  const progressRef = useRef(0);

  const report = useCallback(
    async (section: BriefingSection) => {
      try {
        const res = await apiFetch<{ guest: GuestPublic }>('/api/briefing/progress', {
          method: 'POST',
          token,
          body: { section, progress: progressRef.current },
        });
        setGuest(res.guest);
      } catch {
        // Non-fatal: progress will be re-sent with the next section
        furthestSent.current = Math.min(furthestSent.current, idx(section) - 1);
      }
    },
    [token, setGuest],
  );

  const complete = useCallback(async () => {
    setCompletionState('sending');
    try {
      const res = await apiFetch<{ guest: GuestPublic }>('/api/briefing/complete', { method: 'POST', token });
      setGuest(res.guest);
      setCompletionState('done');
    } catch {
      setCompletionState('error');
    }
  }, [token, setGuest]);

  // Scroll progress (0–100)
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))) : 0;
        progressRef.current = p;
        setProgress(p);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [root]);

  // Section observers
  useEffect(() => {
    if (!root) return;
    const els = [...root.querySelectorAll<HTMLElement>('[data-section]')];

    // Active section = the one crossing the middle of the viewport
    const activeIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.getAttribute('data-section') as BriefingSection);
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );

    // Reached = section substantially visible
    const reachIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const s = e.target.getAttribute('data-section') as BriefingSection;
          const i = idx(s);
          setReached((r) => Math.max(r, i));
          if (i > furthestSent.current) {
            furthestSent.current = i;
            void report(s);
          }
        }
      },
      // section crosses the central 30% band of the viewport
      { rootMargin: '-35% 0px -35% 0px' },
    );

    els.forEach((el) => {
      activeIo.observe(el);
      reachIo.observe(el);
    });
    return () => {
      activeIo.disconnect();
      reachIo.disconnect();
    };
  }, [root, report]);

  // Completion: summary must stay on screen for a moment
  useEffect(() => {
    if (!root || completionState !== 'pending') return;
    const summary = root.querySelector('[data-section="summary"]');
    if (!summary) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        window.clearTimeout(timer);
        if (e.isIntersecting) {
          timer = window.setTimeout(async () => {
            io.disconnect();
            // make sure the progress for "summary" is stored before completing
            if (furthestSent.current < idx('summary')) {
              furthestSent.current = idx('summary');
              await report('summary');
            }
            void complete();
          }, 1400);
        }
      },
      { rootMargin: '-30% 0px -30% 0px' },
    );
    io.observe(summary);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [root, completionState, complete, report]);

  return {
    attach: setRoot,
    active,
    progress,
    reached,
    completion: { state: completionState, retry: complete } satisfies Completion,
  };
}
