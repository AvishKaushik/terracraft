import { useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { atlasTexture } from '../lib/atlas';
import { GRAVITY, TEX_SIZE, ATLAS_COLS } from '../lib/constants';
import { BLOCKS } from '../lib/blocks';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export interface BreakParticlesHandle {
  spawn: (x: number, y: number, z: number, blockId?: number) => void;
}

const colorCache = new Map<number, number[]>();

function getBlockColors(blockId: number): number[] {
  if (colorCache.has(blockId)) return colorCache.get(blockId)!;

  const def = BLOCKS[blockId];
  const tileIdx = def
    ? (def.tex.side ?? def.tex.all ?? def.tex.top ?? 3)
    : 3;

  const canvas = atlasTexture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [0x888888];

  const col = tileIdx % ATLAS_COLS;
  const row = Math.floor(tileIdx / ATLAS_COLS);
  const ox = col * TEX_SIZE;
  const oy = row * TEX_SIZE;
  const data = ctx.getImageData(ox, oy, TEX_SIZE, TEX_SIZE).data;

  const palette: number[] = [];
  const step = 4; // sample every 4 pixels
  for (let p = 0; p < TEX_SIZE * TEX_SIZE; p += step) {
    const i = p * 4;
    if (data[i + 3] < 64) continue; // skip transparent pixels
    palette.push((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
  }
  if (palette.length === 0) palette.push(0x888888);

  colorCache.set(blockId, palette);
  return palette;
}

export const BreakParticles = forwardRef<BreakParticlesHandle>((_props, ref) => {
  const { scene } = useThree();
  const particles = useRef<Particle[]>([]);

  useImperativeHandle(ref, () => ({
    spawn(x, y, z, blockId?: number) {
      const palette = getBlockColors(blockId ?? 3);
      for (let i = 0; i < 8; i++) {
        const color = palette[Math.floor(Math.random() * palette.length)];
        const geom = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y, z);
        scene.add(mesh);
        particles.current.push({
          mesh,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            Math.random() * 4 + 1,
            (Math.random() - 0.5) * 4
          ),
          life: 0.7 + Math.random() * 0.4,
        });
      }
    },
  }));

  useFrame((_state, dt) => {
    const ps = particles.current;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.vel.y -= GRAVITY * dt;
      p.mesh.position.x += p.vel.x * dt;
      p.mesh.position.y += p.vel.y * dt;
      p.mesh.position.z += p.vel.z * dt;
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.z += dt * 4;
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        ps.splice(i, 1);
      }
    }
  });

  return null;
});
