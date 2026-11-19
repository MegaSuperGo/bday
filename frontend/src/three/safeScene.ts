import { gsap } from 'gsap';
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Raycaster,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, createStage, dragRotate, rng, type SceneFactory } from './core';

/** Brushed-metal roughness texture: fine horizontal streaks. */
function brushed(seed: number) {
  const r = rng(seed);
  const c = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = 'rgb(150,150,150)';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const v = 110 + Math.floor(r() * 90);
      ctx.strokeStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
      ctx.lineWidth = r() * 1.4;
      const y = r() * s;
      const x = r() * s;
      ctx.beginPath();
      ctx.moveTo(x - 40 - r() * 200, y);
      ctx.lineTo(x + 40 + r() * 200, y + (r() - 0.5) * 1.5);
      ctx.stroke();
    }
  });
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

function dialFace() {
  const c = canvasTexture(512, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s / 2);
    g.addColorStop(0, '#5b6570');
    g.addColorStop(0.7, '#2c333b');
    g.addColorStop(1, '#1a1f25');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = '#d9e1e8';
    ctx.fillStyle = '#d9e1e8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 30px ui-monospace, Menlo, monospace';
    for (let i = 0; i < 100; i++) {
      const a = (i / 100) * Math.PI * 2;
      const major = i % 10 === 0;
      const r0 = major ? 196 : i % 5 === 0 ? 208 : 214;
      ctx.lineWidth = major ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
      ctx.lineTo(Math.sin(a) * 236, -Math.cos(a) * 236);
      ctx.stroke();
      if (major) ctx.fillText(String(i), Math.sin(a) * 160, -Math.cos(a) * 160);
    }
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.stroke();
  });
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export const createSafeScene: SceneFactory = (host, opts) => {
  const camera = new PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0.9, 0.7, 7.2);
  camera.lookAt(0, -0.05, 0);
  const stage = createStage(host, camera, { mobile: opts.mobile });
  const { scene } = stage;
  scene.environmentIntensity = 0.75;

  const root = new Group();
  scene.add(root);
  const safe = new Group();
  root.add(safe);

  // ---------- materials ----------
  const rough = brushed(7);
  const bodyMat = new MeshPhysicalMaterial({ color: 0x272d35, metalness: 0.88, roughness: 0.62, roughnessMap: rough, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const doorMat = new MeshPhysicalMaterial({ color: 0x3a434e, metalness: 0.92, roughness: 0.45, roughnessMap: rough, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const chrome = new MeshStandardMaterial({ color: 0xd5dde4, metalness: 1, roughness: 0.16 });
  const darkMetal = new MeshStandardMaterial({ color: 0x15191e, metalness: 0.7, roughness: 0.5 });
  const accent = new MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false });

  // ---------- body ----------
  const W = 2.2, H = 2.5, D = 1.9;
  const body = new Mesh(new RoundedBoxGeometry(W, H, D, 5, 0.1), bodyMat);
  safe.add(body);
  // recessed frame around the door
  const frame = new Mesh(new RoundedBoxGeometry(1.98, 2.28, 0.04, 3, 0.02), darkMetal);
  frame.position.z = D / 2 + 0.005;
  safe.add(frame);
  // seam light, visible once the door opens
  const seamMat = new MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0, toneMapped: false });
  const seam = new Mesh(new PlaneGeometry(1.86, 2.16), seamMat);
  seam.position.z = D / 2 + 0.03;
  safe.add(seam);
  // feet
  for (const [x, z] of [[-0.9, -0.75], [0.9, -0.75], [-0.9, 0.75], [0.9, 0.75]]) {
    const f = new Mesh(new BoxGeometry(0.22, 0.08, 0.22), darkMetal);
    f.position.set(x, -H / 2 - 0.04, z);
    safe.add(f);
  }

  // ---------- door (pivots on the left hinge) ----------
  const hinge = new Group();
  hinge.position.set(-0.93, 0, D / 2 + 0.09);
  safe.add(hinge);
  const door = new Group();
  door.position.x = 0.93;
  hinge.add(door);
  door.add(new Mesh(new RoundedBoxGeometry(1.86, 2.16, 0.14, 4, 0.05), doorMat));

  for (const y of [-0.7, 0.7]) {
    const h = new Mesh(new CylinderGeometry(0.06, 0.06, 0.42, 24), chrome);
    h.position.set(-0.02, y, 0.0);
    hinge.add(h);
  }

  // rivets
  const rivetGeo = new SphereGeometry(0.028, 12, 8);
  for (let i = 0; i < 9; i++) {
    const y = -0.95 + (i * 1.9) / 8;
    for (const x of [-0.82, 0.82]) {
      const r = new Mesh(rivetGeo, chrome);
      r.position.set(x, y, 0.07);
      r.scale.z = 0.5;
      door.add(r);
    }
  }

  // combination dial
  const dial = new Group();
  dial.position.set(0.3, 0.42, 0.07);
  door.add(dial);
  const bezel = new Mesh(new TorusGeometry(0.4, 0.035, 16, 64), chrome);
  dial.add(bezel);
  const dialBody = new Group();
  dial.add(dialBody);
  const face = dialFace();
  const dialMesh = new Mesh(new CylinderGeometry(0.36, 0.37, 0.1, 64), [
    new MeshStandardMaterial({ color: 0xc7cfd6, metalness: 1, roughness: 0.28 }),
    new MeshStandardMaterial({ map: face, metalness: 0.85, roughness: 0.32 }),
    darkMetal,
  ]);
  dialMesh.rotation.x = Math.PI / 2;
  dialMesh.position.z = 0.05;
  dialMesh.rotation.y = 0;
  dialBody.add(dialMesh);
  const knob = new Mesh(new CylinderGeometry(0.11, 0.13, 0.12, 32), chrome);
  knob.rotation.x = Math.PI / 2;
  knob.position.z = 0.14;
  dialBody.add(knob);
  const notch = new Mesh(new BoxGeometry(0.03, 0.08, 0.03), accent);
  notch.position.set(0, 0.47, 0.03);
  dial.add(notch);

  // handle wheel
  const handle = new Group();
  handle.position.set(0.3, -0.48, 0.07);
  door.add(handle);
  const hub = new Mesh(new CylinderGeometry(0.12, 0.14, 0.12, 32), chrome);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 0.06;
  handle.add(hub);
  for (let i = 0; i < 3; i++) {
    const arm = new Group();
    arm.rotation.z = (i * Math.PI * 2) / 3;
    const spoke = new Mesh(new CylinderGeometry(0.026, 0.03, 0.44, 16), chrome);
    spoke.position.set(0, 0.26, 0.08);
    const ball = new Mesh(new SphereGeometry(0.055, 20, 14), chrome);
    ball.position.set(0, 0.49, 0.08);
    arm.add(spoke, ball);
    handle.add(arm);
  }

  // status display
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 512;
  screenCanvas.height = 192;
  const screenTex = new CanvasTexture(screenCanvas);
  screenTex.colorSpace = SRGBColorSpace;
  const drawScreen = (title: string, sub: string, color = '#38bdf8') => {
    const ctx = screenCanvas.getContext('2d')!;
    ctx.fillStyle = '#04070a';
    ctx.fillRect(0, 0, 512, 192);
    ctx.strokeStyle = 'rgba(56,189,248,0.18)';
    for (let y = 0; y < 192; y += 6) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.font = '600 58px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 28, 80);
    ctx.globalAlpha = 0.65;
    ctx.font = '500 26px ui-monospace, Menlo, monospace';
    ctx.fillText(sub, 28, 142);
    ctx.globalAlpha = 1;
    screenTex.needsUpdate = true;
  };
  drawScreen('GESICHERT', 'NEXUS · SCHLOSS 03');
  const screenFrame = new Mesh(new RoundedBoxGeometry(0.66, 0.3, 0.04, 2, 0.015), darkMetal);
  screenFrame.position.set(-0.42, 0.62, 0.08);
  door.add(screenFrame);
  const screen = new Mesh(new PlaneGeometry(0.6, 0.225), new MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(-0.42, 0.62, 0.101);
  door.add(screen);

  // keypad
  const keyGeo = new RoundedBoxGeometry(0.13, 0.1, 0.04, 2, 0.015);
  const keyMat = new MeshStandardMaterial({ color: 0x20262d, metalness: 0.6, roughness: 0.4 });
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 3; c++) {
      const k = new Mesh(keyGeo, keyMat);
      k.position.set(-0.6 + c * 0.17, 0.32 - r * 0.14, 0.085);
      door.add(k);
    }
  }
  const led = new Mesh(new SphereGeometry(0.02, 12, 8), new MeshBasicMaterial({ color: 0xf2b54a, toneMapped: false }));
  led.position.set(-0.68, -0.32, 0.09);
  door.add(led);

  // locking bolts on the door edge
  const bolts: Mesh[] = [];
  for (const y of [-0.6, 0, 0.6]) {
    const b = new Mesh(new CylinderGeometry(0.05, 0.05, 0.3, 20), chrome);
    b.rotation.z = Math.PI / 2;
    b.position.set(0.98, y, 0);
    door.add(b);
    bolts.push(b);
  }

  // ---------- scan effect ----------
  const edgeMat = new LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0, toneMapped: false });
  const edges = new LineSegments(new EdgesGeometry(new BoxGeometry(W + 0.02, H + 0.02, D + 0.02)), edgeMat);
  safe.add(edges);
  const scanTex = new CanvasTexture(
    canvasTexture(4, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(56,189,248,0)');
      g.addColorStop(0.92, 'rgba(56,189,248,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,1)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 128);
    }, 128),
  );
  const scanMat = new MeshBasicMaterial({ map: scanTex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
  const scanPlane = new Mesh(new PlaneGeometry(3, 0.7), scanMat);
  scanPlane.position.z = D / 2 + 0.4;
  safe.add(scanPlane);

  // ---------- floor shadow ----------
  const shadowTex = new CanvasTexture(
    canvasTexture(256, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }),
  );
  const shadow = new Mesh(new PlaneGeometry(4.2, 3.4), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -H / 2 - 0.08;
  root.add(shadow);

  // ---------- lights ----------
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  const rim = new PointLight(0x38bdf8, 18, 9, 1.6);
  rim.position.set(2.6, 1.4, -1.8);
  const fill = new PointLight(0x9fb3c8, 6, 10, 1.6);
  fill.position.set(3, -1, 4);
  scene.add(key, rim, fill);

  // ---------- interaction ----------
  let userYaw = 0;
  let userPitch = 0;
  let pointerX = 0;
  let pointerY = 0;
  let progress = 0;
  const stopDrag = dragRotate(host, (dx, dy) => {
    userYaw += dx * 0.008;
    userPitch = Math.max(-0.25, Math.min(0.25, userPitch + dy * 0.004));
  });
  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointerX = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointerY = ((e.clientY - r.top) / r.height) * 2 - 1;
  };
  host.addEventListener('pointermove', onMove);

  // Clicking the dial spins it one notch further – a small tactile detail
  const ray = new Raycaster();
  const ndc = new Vector2();
  let downAt = 0;
  const onDown = () => (downAt = performance.now());
  const onClick = (e: PointerEvent) => {
    if (performance.now() - downAt > 250) return;
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.intersectObjects(dialBody.children, false).length) {
      gsap.to(dialBody.rotation, { z: dialBody.rotation.z - Math.PI / 5, duration: 0.35, ease: 'back.out(2)' });
      opts.onEvent?.('tick');
    }
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointerup', onClick);

  // ---------- unlock sequence ----------
  let activated = false;
  const unlockFinal = () => {
    drawScreen('ENTSPERRT', 'ZUGANG FREIGEGEBEN', '#5ee0a8');
    (led.material as MeshBasicMaterial).color.set(0x5ee0a8);
    handle.rotation.z = -Math.PI / 2;
    bolts.forEach((b) => (b.position.x = 0.8));
    hinge.rotation.y = -0.2;
    seamMat.opacity = 0.9;
    opts.onEvent?.('unlocked');
  };

  const activate = () => {
    if (activated) return;
    activated = true;
    if (opts.reducedMotion) {
      unlockFinal();
      return;
    }
    const tl = gsap.timeline();
    tl.call(() => {
      drawScreen('SCAN', 'STRUKTURANALYSE LÄUFT');
      opts.onEvent?.('scan');
    })
      .to(edgeMat, { opacity: 0.8, duration: 0.4 })
      .to(scanMat, { opacity: 1, duration: 0.2 }, 0)
      .fromTo(scanPlane.position, { y: H / 2 + 0.4 }, { y: -H / 2 - 0.2, duration: 1.6, ease: 'power1.inOut' }, 0)
      .to(scanMat, { opacity: 0, duration: 0.3 }, 1.4)
      .to(edgeMat, { opacity: 0, duration: 0.6 }, 1.5)
      .call(() => {
        drawScreen('ANALYSE', 'MECHANISMUS ERKANNT');
        opts.onEvent?.('analyse');
      }, undefined, 1.6)
      .to(dialBody.rotation, { z: '-=' + Math.PI * 2.2, duration: 1.2, ease: 'power2.inOut', onStart: () => opts.onEvent?.('tick') }, 1.7)
      .to(dialBody.rotation, { z: '+=' + Math.PI * 1.4, duration: 1, ease: 'power2.inOut', onStart: () => opts.onEvent?.('tick') })
      .to(dialBody.rotation, { z: '-=' + Math.PI * 0.6, duration: 0.6, ease: 'power2.inOut', onStart: () => opts.onEvent?.('tick') })
      .call(() => {
        drawScreen('ENTSPERRT', 'ZUGANG FREIGEGEBEN', '#5ee0a8');
        (led.material as MeshBasicMaterial).color.set(0x5ee0a8);
        opts.onEvent?.('unlocked');
      })
      .to(handle.rotation, { z: -Math.PI / 2, duration: 0.8, ease: 'power3.inOut' })
      .to(bolts.map((b) => b.position), { x: 0.8, duration: 0.5, stagger: 0.08, ease: 'power2.in' }, '<0.2')
      .to(hinge.rotation, { y: -0.2, duration: 1.4, ease: 'power3.out' })
      .to(seamMat, { opacity: 0.9, duration: 1 }, '<');
  };

  stage.start((_dt, t) => {
    // pull back on portrait screens so the open door never clips
    camera.position.z = camera.aspect < 1.05 ? 7.2 * (1.05 / camera.aspect) ** 0.9 : 7.2;
    const idle = opts.reducedMotion ? 0 : Math.sin(t * 0.3) * 0.12;
    const targetYaw = -0.55 + progress * 0.9 + idle + userYaw + pointerX * 0.12;
    const targetPitch = userPitch + pointerY * 0.06;
    safe.rotation.y += (targetYaw - safe.rotation.y) * 0.06;
    safe.rotation.x += (targetPitch - safe.rotation.x) * 0.06;
    safe.position.y = opts.reducedMotion ? 0 : Math.sin(t * 0.9) * 0.035;
    rim.intensity = 16 + Math.sin(t * 1.3) * 3;
  });

  return {
    setRunning: stage.setRunning,
    setProgress: (p) => (progress = p),
    activate,
    dispose() {
      gsap.killTweensOf([dialBody.rotation, handle.rotation, hinge.rotation, edgeMat, scanMat, seamMat, scanPlane.position]);
      stopDrag();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointerup', onClick);
      [rough, face, screenTex, scanTex, shadowTex].forEach((t) => t.dispose());
      stage.dispose();
    },
  };
};
