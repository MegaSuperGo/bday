import {
  ACESFilmicToneMapping,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type PerspectiveCamera,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SceneOptions {
  reducedMotion: boolean;
  mobile: boolean;
  onEvent?: (name: string) => void;
}

export interface SceneHandle {
  dispose(): void;
  /** 0..1 scroll progress through the host section */
  setProgress?(p: number): void;
  /** called when the stage becomes visible / hidden */
  setRunning(running: boolean): void;
  /** called once when the section is first revealed */
  activate?(): void;
}

export type SceneFactory = (host: HTMLElement, opts: SceneOptions) => SceneHandle;

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

interface Stage {
  renderer: WebGLRenderer;
  scene: Scene;
  envMap: Texture | null;
  start(loop: (dt: number, t: number) => void): void;
  setRunning(r: boolean): void;
  dispose(): void;
}

/**
 * Creates a renderer bound to `host`, with resize handling, a capped pixel
 * ratio, a PBR environment for realistic reflections and a pausable loop.
 */
export function createStage(host: HTMLElement, camera: PerspectiveCamera, opts: { mobile: boolean; alpha?: boolean; fps?: number; env?: boolean }): Stage {
  const renderer = new WebGLRenderer({ antialias: !opts.mobile, alpha: opts.alpha ?? true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.mobile ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  let envMap: Texture | null = null;
  if (opts.env !== false) {
    const pmrem = new PMREMGenerator(renderer);
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envMap;
  }

  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let running = false;
  let raf = 0;
  let last = 0;
  let loopFn: ((dt: number, t: number) => void) | null = null;
  const minFrame = opts.fps ? 1000 / opts.fps : 0;

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    if (minFrame && now - last < minFrame - 1) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    loopFn?.(dt, now / 1000);
    renderer.render(scene, camera);
  };

  const onVisibility = () => setRunning(running);
  document.addEventListener('visibilitychange', onVisibility);

  function setRunning(r: boolean) {
    running = r;
    cancelAnimationFrame(raf);
    if (r && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  return {
    renderer,
    scene,
    envMap,
    start(loop) {
      loopFn = loop;
      // render one frame immediately so the stage is never empty
      loop(0.016, performance.now() / 1000);
      renderer.render(scene, camera);
    },
    setRunning,
    dispose() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      scene.traverse((o) => {
        const mesh = o as unknown as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
        mesh.geometry?.dispose();
        const m = mesh.material;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      envMap?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** Canvas helper for procedural textures. */
export function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, h = size): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h;
  draw(c.getContext('2d')!, size);
  return c;
}

/** Seeded PRNG so procedural assets look identical on every load. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Horizontal drag to rotate. Uses pointer events with `touch-action: pan-y`
 * so vertical swipes still scroll the page on touch devices.
 */
export function dragRotate(el: HTMLElement, onDelta: (dx: number, dy: number) => void) {
  let down = false;
  let lx = 0;
  let ly = 0;
  el.style.touchAction = 'pan-y';
  el.style.cursor = 'grab';
  const pd = (e: PointerEvent) => {
    down = true;
    lx = e.clientX;
    ly = e.clientY;
    el.style.cursor = 'grabbing';
  };
  const pm = (e: PointerEvent) => {
    if (!down) return;
    onDelta(e.clientX - lx, e.pointerType === 'mouse' ? e.clientY - ly : 0);
    lx = e.clientX;
    ly = e.clientY;
  };
  const pu = () => {
    down = false;
    el.style.cursor = 'grab';
  };
  el.addEventListener('pointerdown', pd);
  window.addEventListener('pointermove', pm);
  window.addEventListener('pointerup', pu);
  el.addEventListener('pointercancel', pu);
  return () => {
    el.removeEventListener('pointerdown', pd);
    window.removeEventListener('pointermove', pm);
    window.removeEventListener('pointerup', pu);
    el.removeEventListener('pointercancel', pu);
  };
}
