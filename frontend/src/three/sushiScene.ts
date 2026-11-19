import { gsap } from 'gsap';
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PointLight,
  Quaternion,
  Raycaster,
  RepeatWrapping,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, createStage, dragRotate, rng, type SceneFactory } from './core';

// 1 scene unit ≈ 5 cm. All geometry is procedural (no external assets).

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new CanvasTexture(c);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Fish flesh: base colour with soft, wavy fat lines (myosepta). */
function fishTexture(seed: number, base: [string, string], fat: string, lines: number, alpha: number) {
  const r = rng(seed);
  return tex(
    canvasTexture(
      1024,
      (ctx) => {
        const g = ctx.createLinearGradient(0, 0, 1024, 512);
        g.addColorStop(0, base[0]);
        g.addColorStop(1, base[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1024, 512);
        ctx.filter = 'blur(3px)';
        for (let i = 0; i < lines; i++) {
          const x0 = -200 + (i / lines) * 1450 + r() * 20;
          ctx.strokeStyle = fat;
          ctx.globalAlpha = alpha * (0.6 + r() * 0.4);
          ctx.lineWidth = 5 + r() * 9;
          ctx.beginPath();
          ctx.moveTo(x0, -20);
          for (let y = 0; y <= 540; y += 30) {
            ctx.lineTo(x0 + y * 0.45 + Math.sin(y / 70 + i) * 14, y);
          }
          ctx.stroke();
        }
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        // fine grain
        for (let i = 0; i < 9000; i++) {
          ctx.fillStyle = `rgba(255,255,255,${r() * 0.05})`;
          ctx.fillRect(r() * 1024, r() * 512, 2, 2);
        }
      },
      512,
    ),
  );
}

function noriTexture() {
  const r = rng(42);
  const t = tex(
    canvasTexture(512, (ctx, s) => {
      ctx.fillStyle = '#16211a';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 5000; i++) {
        const v = r();
        ctx.fillStyle = v > 0.5 ? `rgba(70,95,60,${r() * 0.25})` : `rgba(0,0,0,${r() * 0.35})`;
        ctx.save();
        ctx.translate(r() * s, r() * s);
        ctx.rotate(r() * Math.PI);
        ctx.fillRect(0, 0, 2 + r() * 14, 1 + r() * 2);
        ctx.restore();
      }
    }),
  );
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

function slateTexture() {
  const r = rng(9);
  const t = tex(
    canvasTexture(1024, (ctx, s) => {
      ctx.fillStyle = '#1a1d21';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 26000; i++) {
        const v = 20 + Math.floor(r() * 30);
        ctx.fillStyle = `rgba(${v},${v + 2},${v + 5},${0.25 + r() * 0.35})`;
        ctx.fillRect(r() * s, r() * s, 1 + r() * 3, 1 + r() * 2);
      }
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 40; i++) {
        ctx.strokeStyle = r() > 0.5 ? '#3a4048' : '#0c0e10';
        ctx.lineWidth = 1 + r() * 2;
        ctx.beginPath();
        const y = r() * s;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 60, s * 0.6, y + (r() - 0.5) * 60, s, y + (r() - 0.5) * 40);
        ctx.stroke();
      }
    }),
  );
  return t;
}

/** Bend a box into a draped fish slice. */
function fishSliceGeometry(len: number, width: number, thick: number) {
  const g = new BoxGeometry(len, thick, width, 40, 2, 14);
  const p = g.attributes.position;
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = v.x / (len / 2);
    const w = v.z / (width / 2);
    const taper = 1 - 0.55 * u ** 4;
    v.y *= taper * (1 - 0.25 * w ** 4);
    v.z *= 1 - 0.22 * u ** 4;
    v.x += 0.07 * w; // diagonal cut
    v.y += -0.17 * u * u - 0.07 * w * w; // drape over the rice
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

interface RiceOptions {
  rx: number;
  ry: number;
  rz: number;
  count: number;
  seed: number;
  flatBottom?: number;
}

/** Ellipsoid of rice: a matte core plus hundreds of instanced grains. */
function riceMound(o: RiceOptions, grainMat: MeshPhysicalMaterial, coreMat: MeshStandardMaterial, grainGeo: BufferGeometry) {
  const group = new Group();
  const core = new Mesh(new SphereGeometry(1, 32, 20), coreMat);
  core.scale.set(o.rx * 0.93, o.ry * 0.9, o.rz * 0.93);
  core.castShadow = true;
  group.add(core);

  const r = rng(o.seed);
  const grains = new InstancedMesh(grainGeo, grainMat, o.count);
  grains.instanceMatrix.setUsage(DynamicDrawUsage);
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const pos = new Vector3();
  const scl = new Vector3();
  const tint = new Color();
  for (let i = 0; i < o.count; i++) {
    // uniform point on the unit sphere, mapped onto the ellipsoid
    const th = r() * Math.PI * 2;
    const z = r() * 2 - 1;
    const rr = Math.sqrt(1 - z * z);
    const k = 0.96 + r() * 0.06;
    pos.set(Math.cos(th) * rr * o.rx * k, z * o.ry * k, Math.sin(th) * rr * o.rz * k);
    if (o.flatBottom !== undefined && pos.y < o.flatBottom) pos.y = o.flatBottom + r() * 0.01;
    e.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
    q.setFromEuler(e);
    const s = 0.9 + r() * 0.25;
    scl.set(0.052 * s, 0.021 * s, 0.022 * s);
    m.compose(pos, q, scl);
    grains.setMatrixAt(i, m);
    tint.setScalar(0.92 + r() * 0.08);
    grains.setColorAt(i, tint);
  }
  grains.castShadow = false;
  group.add(grains);
  return group;
}

export const createSushiScene: SceneFactory = (host, opts) => {
  const camera = new PerspectiveCamera(30, 1, 0.1, 60);
  const stage = createStage(host, camera, { mobile: opts.mobile });
  const { scene, renderer } = stage;
  scene.environmentIntensity = 0.32;
  if (!opts.mobile) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
  }

  // ---------- materials ----------
  const grainGeo = new SphereGeometry(1, 8, 6);
  const grainMat = new MeshPhysicalMaterial({ color: 0xf6f3ec, roughness: 0.42, sheen: 0.6, sheenColor: new Color(0xffffff), sheenRoughness: 0.4, clearcoat: 0.15 });
  const coreMat = new MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.9 });
  const salmonTex = fishTexture(3, ['#f2602c', '#d9481c'], 'rgba(255,226,206,1)', 13, 0.75);
  const tunaTex = fishTexture(5, ['#b3122f', '#8f0e26'], 'rgba(255,190,200,1)', 9, 0.18);
  const salmonMat = new MeshPhysicalMaterial({ map: salmonTex, roughness: 0.36, clearcoat: 0.85, clearcoatRoughness: 0.16, sheen: 0.35, sheenColor: new Color(0xffb38f) });
  const tunaMat = new MeshPhysicalMaterial({ map: tunaTex, roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.14, sheen: 0.25, sheenColor: new Color(0xff8a9a) });
  const noriTex = noriTexture();
  const noriMat = new MeshPhysicalMaterial({ map: noriTex, roughness: 0.62, sheen: 0.5, sheenColor: new Color(0x3d5a3a), sheenRoughness: 0.6 });
  const slateMat = new MeshStandardMaterial({ map: slateTexture(), roughness: 0.82, metalness: 0.05 });
  const ceramic = new MeshPhysicalMaterial({ color: 0xeceae6, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const soyMat = new MeshPhysicalMaterial({ color: 0x1c0a04, roughness: 0.04, clearcoat: 1, metalness: 0 });
  const wasabiMat = new MeshStandardMaterial({ color: 0x8fb04b, roughness: 0.75 });
  const gingerMat = new MeshPhysicalMaterial({ color: 0xf3c1b0, roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0.88 });
  const lacquer = new MeshPhysicalMaterial({ color: 0x0d0f12, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const tipMat = new MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.3, clearcoat: 1, emissive: 0x0b3a52 });

  const set = new Group();
  scene.add(set);
  const grainCount = opts.mobile ? 240 : 460;

  // ---------- slate board ----------
  const board = new Mesh(new RoundedBoxGeometry(4.1, 0.12, 2.1, 3, 0.04), slateMat);
  board.position.y = -0.06;
  board.receiveShadow = true;
  set.add(board);

  const pieces: Group[] = [];
  const restY: number[] = [];

  // ---------- nigiri ----------
  const nigiri = (fish: MeshPhysicalMaterial, seed: number) => {
    const g = new Group();
    const rice = riceMound({ rx: 0.52, ry: 0.2, rz: 0.25, count: grainCount, seed, flatBottom: -0.13 }, grainMat, coreMat, grainGeo);
    rice.position.y = 0.14;
    const slice = new Mesh(fishSliceGeometry(1.32, 0.62, 0.11), fish);
    slice.position.y = 0.39;
    slice.castShadow = true;
    g.add(rice, slice);
    return g;
  };
  const place = (g: Group, x: number, z: number, ry: number) => {
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    set.add(g);
    pieces.push(g);
    restY.push(0);
  };
  place(nigiri(salmonMat, 11), -1.25, 0.38, 0.32);
  place(nigiri(salmonMat, 12), -0.25, 0.48, 0.22);
  place(nigiri(tunaMat, 13), 0.62, 0.28, 0.1);

  // ---------- maki ----------
  const maki = (seed: number, filling: 'salmon' | 'tuna') => {
    const g = new Group();
    const h = 0.42;
    const rad = 0.34;
    const outer = new CylinderGeometry(rad, rad, h, 56, 3, true);
    const pp = outer.attributes.position;
    const rr = rng(seed);
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i);
      const z = pp.getZ(i);
      const a = Math.atan2(z, x);
      const k = 1 + Math.sin(a * 7 + seed) * 0.008 + (rr() - 0.5) * 0.006;
      pp.setXYZ(i, x * k, pp.getY(i), z * k);
    }
    outer.computeVertexNormals();
    const nori = new Mesh(outer, noriMat);
    nori.position.y = h / 2;
    nori.castShadow = true;
    g.add(nori);

    const top = new Mesh(new CircleGeometry(rad - 0.012, 48), coreMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = h - 0.004;
    g.add(top);
    // grains on the cut surface
    const r = rng(seed * 3);
    const grains = new InstancedMesh(grainGeo, grainMat, opts.mobile ? 70 : 130);
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3();
    for (let i = 0; i < grains.count; i++) {
      const a = r() * Math.PI * 2;
      const d = 0.14 + Math.sqrt(r()) * 0.18;
      pos.set(Math.cos(a) * d, h + 0.004, Math.sin(a) * d);
      q.setFromEuler(new Euler((r() - 0.5) * 0.6, r() * Math.PI, (r() - 0.5) * 0.6));
      const s = 0.9 + r() * 0.25;
      scl.set(0.05 * s, 0.018 * s, 0.021 * s);
      m.compose(pos, q, scl);
      grains.setMatrixAt(i, m);
    }
    g.add(grains);
    // filling
    const fill = new Mesh(new RoundedBoxGeometry(0.15, 0.06, 0.14, 2, 0.02), filling === 'salmon' ? salmonMat : tunaMat);
    fill.position.set(0.01, h, -0.01);
    fill.rotation.y = 0.3;
    const cucumber = new Mesh(new RoundedBoxGeometry(0.06, 0.05, 0.12, 2, 0.015), new MeshStandardMaterial({ color: 0x5f8f3a, roughness: 0.5 }));
    cucumber.position.set(-0.09, h, 0.05);
    cucumber.rotation.y = 0.5;
    g.add(fill, cucumber);
    return g;
  };
  place(maki(1, 'salmon'), -0.95, -0.5, 0);
  place(maki(2, 'tuna'), -0.15, -0.55, 0.8);
  place(maki(3, 'salmon'), 0.65, -0.48, 1.7);

  // ---------- condiments ----------
  const dish = new Group();
  const profile = [
    new Vector2(0.0, 0.0),
    new Vector2(0.28, 0.0),
    new Vector2(0.34, 0.02),
    new Vector2(0.42, 0.1),
    new Vector2(0.44, 0.13),
    new Vector2(0.41, 0.13),
    new Vector2(0.36, 0.06),
    new Vector2(0.0, 0.05),
  ];
  const bowl = new Mesh(new LatheGeometry(profile, 64), ceramic);
  bowl.castShadow = true;
  const soy = new Mesh(new CircleGeometry(0.37, 48), soyMat);
  soy.rotation.x = -Math.PI / 2;
  soy.position.y = 0.085;
  dish.add(bowl, soy);
  dish.position.set(1.5, 0, -0.45);
  set.add(dish);

  const wasabi = new Mesh(new SphereGeometry(0.13, 24, 16), wasabiMat);
  {
    const p = wasabi.geometry.attributes.position;
    const r = rng(77);
    for (let i = 0; i < p.count; i++) {
      const k = 1 + (r() - 0.5) * 0.12;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
    }
    wasabi.geometry.computeVertexNormals();
  }
  wasabi.position.set(1.42, 0.07, 0.42);
  wasabi.castShadow = true;
  set.add(wasabi);

  for (let i = 0; i < 4; i++) {
    const gGeo = new SphereGeometry(0.16, 20, 8, 0, Math.PI * 2, 0, 0.55);
    const ginger = new Mesh(gGeo, gingerMat);
    ginger.scale.set(1, 0.5, 0.8);
    ginger.rotation.set(Math.PI + 0.3, i * 1.3, 0.2 * i);
    ginger.position.set(1.72 + (i % 2) * 0.12, 0.06 + i * 0.012, 0.32 + i * 0.07);
    set.add(ginger);
  }

  // ---------- chopsticks ----------
  for (const dz of [0, 0.09]) {
    const stick = new Group();
    const body = new Mesh(new CylinderGeometry(0.022, 0.04, 3.0, 20), lacquer);
    const tip = new Mesh(new CylinderGeometry(0.0225, 0.0225, 0.32, 20), tipMat);
    tip.position.y = 1.36;
    body.castShadow = true;
    stick.add(body, tip);
    stick.rotation.z = Math.PI / 2;
    stick.rotation.y = 0.12;
    stick.position.set(0.1, 0.07, 0.98 + dz);
    set.add(stick);
  }

  // ---------- lights ----------
  const key = new SpotLight(0xfff1e2, 80, 20, 0.55, 0.85, 1.4);
  key.position.set(-2.6, 5.2, 3.2);
  key.target.position.set(0, 0, 0);
  key.castShadow = !opts.mobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  const rim = new PointLight(0x38bdf8, 30, 12, 1.6);
  rim.position.set(2.8, 1.6, -2.6);
  const fill = new PointLight(0xffe2cc, 2.5, 12, 1.6);
  fill.position.set(2, 1.2, 3.5);
  scene.add(key, key.target, rim, fill);

  // ---------- interaction ----------
  let yaw = -0.35;
  let pitch = 0;
  let velocity = 0;
  let progress = 0;
  const stopDrag = dragRotate(host, (dx, dy) => {
    velocity = dx * 0.006;
    yaw += dx * 0.008;
    pitch = Math.max(-0.18, Math.min(0.22, pitch + dy * 0.003));
  });

  // Easter egg: tap one piece five times
  const ray = new Raycaster();
  const ndc = new Vector2();
  const taps = new Map<Object3D, number>();
  let downAt = 0;
  let downX = 0;
  const onDown = (e: PointerEvent) => {
    downAt = performance.now();
    downX = e.clientX;
  };
  const onUp = (e: PointerEvent) => {
    if (performance.now() - downAt > 260 || Math.abs(e.clientX - downX) > 6) return;
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pieces, true)[0];
    if (!hit) return;
    const piece = pieces.find((p) => {
      let o: Object3D | null = hit.object;
      while (o) {
        if (o === p) return true;
        o = o.parent;
      }
      return false;
    });
    if (!piece) return;
    const n = (taps.get(piece) ?? 0) + 1;
    taps.set(piece, n);
    if (!opts.reducedMotion) gsap.fromTo(piece.position, { y: 0 }, { y: 0.18, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
    if (n === 5) {
      taps.set(piece, 0);
      opts.onEvent?.('nibble');
    } else opts.onEvent?.('tap');
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointerup', onUp);

  const look = new Vector3(0, 0.2, 0);
  stage.start((dt, t) => {
    // camera distance adapts to portrait screens
    // keep the whole board (about 4.6 units wide) in frame on narrow screens
    const halfFov = (camera.fov * Math.PI) / 360;
    const needed = 2.5 / (Math.tan(halfFov) * camera.aspect);
    const base = 7.6 - progress * 0.9;
    const dist = Math.max(base, needed);
    const elev = (3.0 - progress * 0.8) * (dist / base);
    camera.position.set(0, elev, dist);
    camera.lookAt(look);

    if (!opts.reducedMotion) {
      yaw += velocity;
      velocity *= 0.92;
      yaw += dt * 0.06; // slow presentation turn
    }
    set.rotation.y += (yaw + progress * 0.6 - set.rotation.y) * 0.08;
    set.rotation.x += (pitch - set.rotation.x) * 0.08;
    set.position.y = opts.reducedMotion ? 0 : Math.sin(t * 0.8) * 0.04;

    // pieces settle onto the board as the section scrolls in
    const settle = Math.min(1, Math.max(0, (progress - 0.05) / 0.35));
    pieces.forEach((p, i) => {
      const local = opts.reducedMotion ? 1 : Math.min(1, Math.max(0, settle * 1.6 - i * 0.1));
      const ease = 1 - (1 - local) ** 3;
      if (!gsap.isTweening(p.position)) p.position.y = restY[i] + (1 - ease) * (1.4 + i * 0.12);
      p.rotation.z = (1 - ease) * 0.4 * (i % 2 ? 1 : -1);
    });
    rim.intensity = 28 + Math.sin(t * 1.1) * 4;
  });

  return {
    setRunning: stage.setRunning,
    setProgress: (p) => (progress = p),
    dispose() {
      stopDrag();
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerup', onUp);
      pieces.forEach((p) => gsap.killTweensOf(p.position));
      [salmonTex, tunaTex, noriTex, slateMat.map].forEach((t) => t?.dispose());
      stage.dispose();
    },
  };
};
