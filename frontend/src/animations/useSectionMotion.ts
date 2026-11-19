import { useLayoutEffect, type RefObject } from 'react';
import { gsap, MOTION_OK } from './gsap';

/**
 * Standard scroll-in choreography for a briefing section.
 *  [data-reveal]       – fades/slides in, staggered in DOM order
 *  [data-scan]         – a scan line sweeps across, then the content resolves
 *  [data-draw]         – SVG strokes draw themselves
 * Content is fully visible when motion is reduced: initial states are only
 * applied inside the matchMedia block.
 */
export function useSectionMotion(ref: RefObject<HTMLElement | null>, extra?: (root: HTMLElement) => void) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const reveal = root.querySelectorAll<HTMLElement>('[data-reveal]');
      if (reveal.length) {
        gsap.from(reveal, {
          y: 28,
          autoAlpha: 0,
          stagger: 0.08,
          duration: 1,
          scrollTrigger: { trigger: root, start: 'top 72%', once: true },
        });
      }
      root.querySelectorAll<HTMLElement>('[data-scan]').forEach((el) => {
        const line = document.createElement('span');
        line.className = 'scanline';
        el.appendChild(line);
        const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 80%', once: true } });
        tl.from(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'power2.inOut' })
          .fromTo(line, { top: '0%', autoAlpha: 1 }, { top: '100%', duration: 0.9, ease: 'power2.inOut' }, 0)
          .to(line, { autoAlpha: 0, duration: 0.3 });
      });
      root.querySelectorAll<SVGGeometryElement>('[data-draw]').forEach((path) => {
        const len = path.getTotalLength?.() ?? 0;
        if (!len) return;
        gsap.fromTo(
          path,
          { strokeDasharray: len, strokeDashoffset: len },
          { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', scrollTrigger: { trigger: path, start: 'top 85%', once: true } },
        );
      });
      extra?.(root);
    });
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
