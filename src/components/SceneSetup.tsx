import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { dayNight } from '../lib/dayNight';
import { waterState } from '../lib/waterState';
import { animateWater } from '../lib/atlas';
import { useSettingsStore } from '../stores/settingsStore';

const DAY_CYCLE_SECONDS = 300; // 5-minute full day

const WATER_FOG_COLOR = new THREE.Color(0x082850);
const WATER_FOG_NEAR  = 0;
const WATER_FOG_FAR   = 10;

// Sky colours
const SKY_NIGHT   = new THREE.Color(0x03050f); // near-black deep blue
const SKY_SUNRISE = new THREE.Color(0xff6030);
const SKY_DAY     = new THREE.Color(0x9bd4ff);
const SKY_SUNSET  = new THREE.Color(0xff4a18);

// Reusable colour object — avoids allocating a new Color every frame
const _sky = new THREE.Color();

function lerpColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return _sky.lerpColors(a, b, t);
}

// t in [0,1): 0 = midnight, 0.5 = midday
// Night holds dark from t=0→0.17 and t=0.83→1.
// Sunrise/sunset are narrow 8 % bands so the sky stays red only briefly.
function skyColorAt(t: number): THREE.Color {
  if (t < 0.17)  return _sky.copy(SKY_NIGHT);
  if (t < 0.25)  return lerpColor(SKY_NIGHT,   SKY_SUNRISE, (t - 0.17) / 0.08);
  if (t < 0.30)  return lerpColor(SKY_SUNRISE,  SKY_DAY,    (t - 0.25) / 0.05);
  if (t < 0.70)  return _sky.copy(SKY_DAY);
  if (t < 0.75)  return lerpColor(SKY_DAY,      SKY_SUNSET,  (t - 0.70) / 0.05);
  if (t < 0.83)  return lerpColor(SKY_SUNSET,   SKY_NIGHT,   (t - 0.75) / 0.08);
  return _sky.copy(SKY_NIGHT);
}

// 1 at midday, 0 during night — ramps over the same transition bands
function dayFactor(t: number): number {
  if (t < 0.17)  return 0;
  if (t < 0.30)  return (t - 0.17) / 0.13;
  if (t < 0.70)  return 1;
  if (t < 0.83)  return 1 - (t - 0.70) / 0.13;
  return 0;
}

export function SceneSetup() {
  const { scene } = useThree();
  const sunRef   = useRef<THREE.Mesh>(null!);
  const moonRef  = useRef<THREE.Mesh>(null!);
  const starsRef = useRef<THREE.Points>(null!);
  const elapsed  = useRef(DAY_CYCLE_SECONDS * 0.5); // start at midday

  // Star field — 700 points distributed uniformly on a large sphere
  const [starGeom, starMat] = useMemo(() => {
    const count = 700;
    const pos = new Float32Array(count * 3);
    // Seed a cheap deterministic shuffle so stars don't re-randomise on HMR
    let s = 42;
    const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
    for (let i = 0; i < count; i++) {
      const theta = rand() * Math.PI * 2;
      const phi   = Math.acos(2 * rand() - 1);
      const r     = 160;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.2, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    });
    return [g, m];
  }, []);

  // Initialize fog immediately so useFrame can access it on the first tick
  if (!scene.fog) {
    scene.fog = new THREE.Fog(new THREE.Color(0x9bd4ff), 40, 90);
  }

  useFrame((_s, dt) => {
    elapsed.current = (elapsed.current + dt) % DAY_CYCLE_SECONDS;
    const t  = elapsed.current / DAY_CYCLE_SECONDS;
    const df = dayFactor(t);

    const sky = skyColorAt(t);
    scene.background = sky;
    if (scene.fog) (scene.fog as THREE.Fog).color.copy(sky);

    const angle = t * Math.PI * 2;

    // Sun — negate Y so cos(π)=−1 at midday becomes +60 (above map)
    sunRef.current.position.set(Math.sin(angle) * 60, -Math.cos(angle) * 60, -20);
    sunRef.current.visible = df > 0.05;

    // Moon — always opposite the sun
    const moonAngle = angle + Math.PI;
    moonRef.current.position.set(Math.sin(moonAngle) * 60, -Math.cos(moonAngle) * 60, -20);
    moonRef.current.visible = df < 0.5; // visible during night + twilight

    // Stars — fade in as day ends; gentle pulse for a living sky
    const starBase = Math.max(0, 1 - df * 3);
    starMat.opacity = starBase * (0.88 + Math.sin(elapsed.current * 0.4) * 0.12);

    dayNight.factor = df;
    // Chunk meshes handle their own night darkening via material color in ChunkMesh.
    // Keep a very subtle CSS overlay just for atmospheric vignette.
    document.documentElement.style.setProperty('--night-alpha', String((1 - df) * 0.08));

    // Animate water atlas tile
    animateWater(elapsed.current);

    // Underwater fog — override sky colour and compress fog range
    if (waterState.eyeInWater) {
      scene.background = WATER_FOG_COLOR;
      (scene.fog as THREE.Fog).color.copy(WATER_FOG_COLOR);
      (scene.fog as THREE.Fog).near = WATER_FOG_NEAR;
      (scene.fog as THREE.Fog).far  = WATER_FOG_FAR;
    } else {
      const rd = useSettingsStore.getState().renderDistance;
      (scene.fog as THREE.Fog).near = rd * 0.45;
      (scene.fog as THREE.Fog).far  = rd;
    }
  });

  return (
    <>
      {/* Sun */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[8, 12, 12]} />
        <meshBasicMaterial color={0xffe9a3} fog={false} />
      </mesh>

      {/* Moon — slightly smaller, cool blue-white */}
      <mesh ref={moonRef}>
        <sphereGeometry args={[5, 12, 12]} />
        <meshBasicMaterial color={0xdde4ff} fog={false} />
      </mesh>

      {/* Stars */}
      <points ref={starsRef} geometry={starGeom} material={starMat} />
    </>
  );
}
