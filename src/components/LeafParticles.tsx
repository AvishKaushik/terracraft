import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useWorldStore } from '../stores/worldStore';
import { usePlayerStore } from '../stores/playerStore';
import { getBlock } from '../lib/terrain';
import { BLOCKS } from '../lib/blocks';
import { WORLD_H } from '../lib/constants';

const LEAF_COLORS = [0x3a7e2c, 0x4a9438, 0x537a2c, 0x2c6020, 0x8aaa30, 0xb8a820, 0x7a6018];
const MAX_LEAVES     = 50;
const SPAWN_INTERVAL = 0.16; // seconds between attempts
const SPAWN_RADIUS   = 20;

interface Leaf {
  mesh:      THREE.Mesh;
  velY:      number;
  swayX:     number;
  swayZ:     number;
  swayPhase: number;
  swayFreq:  number;
  rotSpeed:  number;
  life:      number;
  maxLife:   number;
}

export function LeafParticles() {
  const { scene } = useThree();
  const leaves = useRef<Leaf[]>([]);
  const timer  = useRef(0);

  useFrame((_s, dt) => {
    const { world } = useWorldStore.getState();
    const { pos }   = usePlayerStore.getState();

    // ── Spawn attempt ────────────────────────────────────────────────────────
    timer.current += dt;
    if (timer.current >= SPAWN_INTERVAL && leaves.current.length < MAX_LEAVES) {
      timer.current = 0;

      if (Math.random() < 0.8) {
        const rx = pos[0] + (Math.random() - 0.5) * SPAWN_RADIUS * 2;
        const rz = pos[2] + (Math.random() - 0.5) * SPAWN_RADIUS * 2;
        const ix = Math.floor(rx), iz = Math.floor(rz);
        const yStart = Math.min(WORLD_H - 1, Math.floor(pos[1]) + 18);

        for (let y = yStart; y > 0; y--) {
          const id = getBlock(world, ix, y, iz);
          if (id === 8) { // leaves block
            const below = getBlock(world, ix, y - 1, iz);
            if (below === 0 || BLOCKS[below]?.transparent) {
              const geo = new THREE.PlaneGeometry(0.10, 0.10);
              const mat = new THREE.MeshBasicMaterial({
                color:      LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
                transparent: true,
                opacity:    1,
                side:       THREE.DoubleSide,
                depthWrite: false,
              });
              const mesh = new THREE.Mesh(geo, mat);
              mesh.position.set(
                rx + (Math.random() - 0.5) * 0.9,
                y  - 0.05 + Math.random() * 0.5,
                rz + (Math.random() - 0.5) * 0.9,
              );
              mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI,
              );
              scene.add(mesh);

              const maxLife = 3.5 + Math.random() * 3;
              leaves.current.push({
                mesh, maxLife, life: maxLife,
                velY:      -(0.40 + Math.random() * 0.55),
                swayX:     (Math.random() - 0.5) * 0.45,
                swayZ:     (Math.random() - 0.5) * 0.45,
                swayPhase: Math.random() * Math.PI * 2,
                swayFreq:  1.3 + Math.random() * 1.4,
                rotSpeed:  (Math.random() - 0.5) * 2.8,
              });
              break;
            }
          } else if (id !== 0) {
            break; // solid block — no leaf canopy above here
          }
        }
      }
    }

    // ── Update ───────────────────────────────────────────────────────────────
    for (let i = leaves.current.length - 1; i >= 0; i--) {
      const l = leaves.current[i];
      l.life       -= dt;
      l.swayPhase  += l.swayFreq * dt;

      l.mesh.position.y += l.velY * dt;
      l.mesh.position.x += (l.swayX + Math.sin(l.swayPhase)       * 0.30) * dt;
      l.mesh.position.z += (l.swayZ + Math.cos(l.swayPhase * 0.8) * 0.22) * dt;
      l.mesh.rotation.y += l.rotSpeed * dt;
      l.mesh.rotation.x  = Math.sin(l.swayPhase * 0.5) * 0.55;

      // Stop leaf if it enters a solid block
      const bx = Math.floor(l.mesh.position.x);
      const by = Math.floor(l.mesh.position.y);
      const bz = Math.floor(l.mesh.position.z);
      const hit = getBlock(world, bx, by, bz);
      if (hit !== 0 && !BLOCKS[hit]?.transparent && !BLOCKS[hit]?.liquid) {
        l.life = Math.min(l.life, 0.8); // quick fade on ground contact
      }

      // Fade out over the last 0.8 s
      (l.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, l.life / 0.8);

      if (l.life <= 0) {
        scene.remove(l.mesh);
        l.mesh.geometry.dispose();
        (l.mesh.material as THREE.Material).dispose();
        leaves.current.splice(i, 1);
      }
    }
  });

  return null;
}
