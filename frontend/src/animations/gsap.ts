import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 0.9 });

export { gsap, ScrollTrigger };

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

// Development-only handle for inspecting/fast-forwarding animations in devtools.
if (import.meta.env.DEV) (window as unknown as { __gsap: typeof gsap }).__gsap = gsap;
