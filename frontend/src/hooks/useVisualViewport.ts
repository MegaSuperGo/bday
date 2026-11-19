import { useEffect } from 'react';

/**
 * Exposes the visual viewport (area not covered by the on-screen keyboard)
 * as CSS variables so the mobile chat sheet always keeps its input visible.
 */
export function useVisualViewportVars(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      const h = vv ? vv.height : window.innerHeight;
      const top = vv ? vv.offsetTop : 0;
      root.style.setProperty('--vv-height', `${h}px`);
      root.style.setProperty('--vv-top', `${top}px`);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
}
