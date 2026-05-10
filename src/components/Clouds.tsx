import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WORLD_W, WORLD_D } from '../lib/constants';

// ── Noise helpers ─────────────────────────────────────────────────────────────
function h2(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = ((n ^ (n >>> 13)) * 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 0xffffffff;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  return (
    h2(ix,   iy)   * (1 - smooth(fx)) * (1 - smooth(fy)) +
    h2(ix+1, iy)   *      smooth(fx)  * (1 - smooth(fy)) +
    h2(ix,   iy+1) * (1 - smooth(fx)) *      smooth(fy)  +
    h2(ix+1, iy+1) *      smooth(fx)  *      smooth(fy)
  );
}
function fbm(x: number, y: number): number {
  return noise(x, y) * 0.500 +
         noise(x * 2.1, y * 2.1) * 0.250 +
         noise(x * 4.3, y * 4.3) * 0.125 +
         noise(x * 8.7, y * 8.7) * 0.063;
}

// ── Cloud texture (built once) ────────────────────────────────────────────────
function buildCloudTexture(): THREE.CanvasTexture {
  const SZ  = 256;
  const c   = document.createElement('canvas');
  c.width   = c.height = SZ;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(SZ, SZ);
  const SCALE = 5.5, THRESH = 0.53, SHARPNESS = 8;

  for (let y = 0; y < SZ; y++) {
    for (let x = 0; x < SZ; x++) {
      const v = fbm(x / SZ * SCALE, y / SZ * SCALE);
      const a = v > THRESH ? Math.min(1, (v - THRESH) * SHARPNESS) : 0;
      const i = (y * SZ + x) * 4;
      img.data[i] = img.data[i+1] = img.data[i+2] = 255;
      img.data[i+3] = Math.floor(a * 215);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex  = new THREE.CanvasTexture(c);
  tex.wrapS  = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function Clouds() {
  const [geom, mat] = useMemo(() => {
    const g = new THREE.PlaneGeometry(192, 192);
    const m = new THREE.MeshBasicMaterial({
      map: buildCloudTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,          // clouds always fully white regardless of distance
      side: THREE.DoubleSide,
    });
    return [g, m];
  }, []);

  useFrame((_s, dt) => {
    // Gentle eastward drift — one full texture cycle ≈ 55 s
    mat.map!.offset.x += 0.018 * dt;
  });

  return (
    <mesh
      geometry={geom}
      material={mat}
      position={[WORLD_W / 2, 36, WORLD_D / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  );
}
