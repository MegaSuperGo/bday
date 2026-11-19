import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  Points,
  ShaderMaterial,
  TorusGeometry,
  Vector2,
} from 'three';
import { createStage, rng } from './core';

export type OrbMood = 'idle' | 'hover' | 'thinking' | 'alert';

export interface OrbHandle {
  setMood(m: OrbMood): void;
  setRunning(r: boolean): void;
  dispose(): void;
}

const noise = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

/**
 * The JARVIS orb: a noise-displaced energy shell with fresnel rim, an inner
 * core, two orbiting rings and a sparse particle halo.
 */
export function createOrb(host: HTMLElement, opts: { reducedMotion: boolean }): OrbHandle {
  const camera = new PerspectiveCamera(32, 1, 0.1, 20);
  camera.position.set(0, 0, 5.2);
  const stage = createStage(host, camera, { mobile: true, alpha: true, fps: 40, env: false });
  const { scene } = stage;

  const uniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0.35 },
    uColor: { value: new Color(0x38bdf8) },
    uRes: { value: new Vector2(1, 1) },
  };

  const shell = new Mesh(
    new IcosahedronGeometry(1, 24),
    new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uEnergy;
        varying vec3 vN; varying vec3 vView; varying float vNoise;
        ${noise}
        void main(){
          float n = snoise(normal * 1.6 + vec3(0.0, uTime * 0.35, uTime * 0.2));
          vNoise = n;
          vec3 p = position + normal * n * (0.05 + uEnergy * 0.07);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uEnergy; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vView; varying float vNoise;
        void main(){
          float fres = pow(1.0 - max(dot(vN, vView), 0.0), 2.4);
          float bands = smoothstep(0.55, 1.0, sin(vNoise * 9.0 + uTime * 1.6) * 0.5 + 0.5);
          float a = fres * 0.95 + bands * (0.08 + uEnergy * 0.18);
          vec3 col = mix(uColor, vec3(1.0), fres * 0.35 + bands * 0.15);
          gl_FragColor = vec4(col * a, a);
        }`,
    }),
  );

  const core = new Mesh(
    new IcosahedronGeometry(0.42, 8),
    new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vView = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uEnergy; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vView;
        void main(){
          float d = max(dot(vN, vView), 0.0);
          float pulse = 0.75 + 0.25 * sin(uTime * (2.0 + uEnergy * 6.0));
          vec3 col = mix(uColor, vec3(1.0), pow(d, 3.0));
          float a = pow(d, 1.5) * pulse;
          gl_FragColor = vec4(col * a, a);
        }`,
    }),
  );

  const ringMat = new ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
      void main(){
        float seg = step(0.35, fract(vUv.x * 12.0 - uTime * 0.2));
        float a = 0.25 + seg * 0.55;
        gl_FragColor = vec4(uColor * a, a);
      }`,
  });
  const ringA = new Mesh(new TorusGeometry(1.32, 0.012, 6, 160), ringMat);
  const ringB = new Mesh(new TorusGeometry(1.5, 0.008, 6, 160), ringMat);
  ringA.rotation.x = 1.2;
  ringB.rotation.x = -0.9;
  ringB.rotation.y = 0.6;

  // particle halo
  const r = rng(5);
  const count = 140;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const th = r() * Math.PI * 2;
    const z = r() * 2 - 1;
    const rad = 1.55 + r() * 0.35;
    const k = Math.sqrt(1 - z * z);
    pos.set([Math.cos(th) * k * rad, z * rad, Math.sin(th) * k * rad], i * 3);
  }
  const pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new BufferAttribute(pos, 3));
  const points = new Points(
    pGeo,
    new ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vA = 0.35 + 0.65 * abs(sin(uTime * 1.5 + position.x * 7.0 + position.y * 5.0));
          gl_PointSize = 2.2 * (5.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor * vA, vA); }`,
    }),
  );

  const g = new Group();
  g.add(shell, core, ringA, ringB, points);
  scene.add(g);

  let targetEnergy = 0.35;
  const targetColor = new Color(0x38bdf8);
  const alertColor = new Color(0xf47272);
  const baseColor = new Color(0x38bdf8);

  stage.start((dt, t) => {
    const speed = opts.reducedMotion ? 0.2 : 1;
    uniforms.uTime.value = t * speed;
    uniforms.uEnergy.value += (targetEnergy - uniforms.uEnergy.value) * Math.min(1, dt * 4);
    uniforms.uColor.value.lerp(targetColor, Math.min(1, dt * 5));
    const e = uniforms.uEnergy.value;
    g.rotation.y += dt * (0.25 + e * 0.8) * speed;
    ringA.rotation.z += dt * (0.4 + e * 1.6) * speed;
    ringB.rotation.z -= dt * (0.3 + e * 1.2) * speed;
    const s = 1 + Math.sin(t * 2.2) * 0.015 * speed + e * 0.04;
    g.scale.setScalar(s);
  });

  return {
    setMood(m) {
      targetEnergy = m === 'idle' ? 0.35 : m === 'hover' ? 0.7 : 1;
      targetColor.copy(m === 'alert' ? alertColor : baseColor);
    },
    setRunning: stage.setRunning,
    dispose: stage.dispose,
  };
}
