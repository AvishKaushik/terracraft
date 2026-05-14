import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { weatherState } from '../lib/weather';
import { usePlayerStore } from '../stores/playerStore';
import { getBiome } from '../lib/terrain';

const RAIN_COUNT   = 2800;
const SNOW_COUNT   = 1600;
const SPREAD       = 36;
const HEIGHT_RANGE = 26;
const RAIN_SPEED   = 28;
const SNOW_SPEED   = 2.4;
const DROP_LEN     = 0.55; // streak length for rain

// ── Rain: LineSegments — each drop is a short diagonal streak ──────────

function makeRainGeo(): THREE.BufferGeometry {
  const pos = new Float32Array(RAIN_COUNT * 6); // 2 verts × 3 floats per drop
  for (let i = 0; i < RAIN_COUNT; i++) {
    const x = (Math.random() - 0.5) * SPREAD;
    // full height range so drops are naturally staggered from the start
    const y = (Math.random() - 0.5) * HEIGHT_RANGE * 2;
    const z = (Math.random() - 0.5) * SPREAD;
    pos[i * 6]     = x;        pos[i * 6 + 1] = y;            pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x - 0.04; pos[i * 6 + 4] = y - DROP_LEN; pos[i * 6 + 5] = z;
  }
  const g = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', attr);
  return g;
}

// ── Snow: Points — soft large flakes with drift ─────────────────────────

function makeSnowGeo(): THREE.BufferGeometry {
  const pos = new Float32Array(SNOW_COUNT * 3);
  for (let i = 0; i < SNOW_COUNT; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * SPREAD;
    // spread flakes across full double height range from the start
    pos[i * 3 + 1] = (Math.random() - 0.5) * HEIGHT_RANGE * 2;
    pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
  }
  const g = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', attr);
  return g;
}

export function Weather() {
  const { camera } = useThree();
  const rainRef  = useRef<THREE.LineSegments>(null!);
  const snowRef  = useRef<THREE.Points>(null!);
  const phases   = useRef(new Float32Array(SNOW_COUNT));
  const wasActive = useRef(false);

  const rainGeo = useMemo(makeRainGeo, []);
  const snowGeo = useMemo(() => {
    const g = makeSnowGeo();
    for (let i = 0; i < SNOW_COUNT; i++) phases.current[i] = Math.random() * Math.PI * 2;
    return g;
  }, []);

  const rainMat = useMemo(() => new THREE.LineBasicMaterial({
    color: 0x9bbdd4,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  }), []);

  const snowMat = useMemo(() => new THREE.PointsMaterial({
    color: 0xddeeff,
    size: 0.22,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    sizeAttenuation: true,
  }), []);

  useFrame((_s, dt) => {
    const type   = weatherState.type;
    const active = type === 'rain' || type === 'thunder';

    const overlay = document.getElementById('rain-overlay');

    if (!active) {
      rainRef.current.visible = false;
      snowRef.current.visible = false;
      if (overlay && wasActive.current) overlay.classList.remove('active', 'thunder');
      wasActive.current = false;
      return;
    }

    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    const pos   = usePlayerStore.getState().pos;
    const biome = getBiome(pos[0], pos[2]);
    const snow  = biome === 'tundra';

    rainRef.current.visible = !snow;
    snowRef.current.visible = snow;

    if (overlay) {
      if (!wasActive.current) overlay.classList.add('active');
      if (type === 'thunder') overlay.classList.add('thunder');
      else overlay.classList.remove('thunder');
    }
    wasActive.current = true;

    if (!snow) {
      const attr = rainGeo.attributes.position as THREE.BufferAttribute;
      const arr  = attr.array as Float32Array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        arr[i * 6 + 1] -= RAIN_SPEED * dt;
        arr[i * 6 + 4] -= RAIN_SPEED * dt;
        if (arr[i * 6 + 4] < cy - HEIGHT_RANGE * 0.5) {
          const nx = cx + (Math.random() - 0.5) * SPREAD;
          // stagger respawn Y across the full height range so drops are never in sync
          const ny = cy + HEIGHT_RANGE * 0.5 * (0.4 + Math.random() * 0.6);
          const nz = cz + (Math.random() - 0.5) * SPREAD;
          arr[i * 6]     = nx;        arr[i * 6 + 1] = ny;            arr[i * 6 + 2] = nz;
          arr[i * 6 + 3] = nx - 0.04; arr[i * 6 + 4] = ny - DROP_LEN; arr[i * 6 + 5] = nz;
        }
      }
      attr.needsUpdate = true;
    } else {
      const attr = snowGeo.attributes.position as THREE.BufferAttribute;
      const arr  = attr.array as Float32Array;
      const ph   = phases.current;
      const t    = performance.now() / 1000;
      for (let i = 0; i < SNOW_COUNT; i++) {
        arr[i * 3]     += Math.sin(t * 0.6 + ph[i]) * 0.35 * dt;
        arr[i * 3 + 1] -= SNOW_SPEED * dt;
        arr[i * 3 + 2] += Math.cos(t * 0.4 + ph[i]) * 0.28 * dt;
        if (arr[i * 3 + 1] < cy - HEIGHT_RANGE * 0.5) {
          arr[i * 3]     = cx + (Math.random() - 0.5) * SPREAD;
          // stagger respawn Y so flakes aren't all at the same height
          arr[i * 3 + 1] = cy + HEIGHT_RANGE * (0.2 + Math.random() * 0.5);
          arr[i * 3 + 2] = cz + (Math.random() - 0.5) * SPREAD;
          ph[i] = Math.random() * Math.PI * 2;
        }
      }
      attr.needsUpdate = true;
    }

  });

  return (
    <>
      <lineSegments ref={rainRef} geometry={rainGeo} material={rainMat} visible={false} />
      <points ref={snowRef} geometry={snowGeo} material={snowMat} visible={false} />
    </>
  );
}
