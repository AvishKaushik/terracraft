import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useWorldStore, type GlowEntry } from '../stores/worldStore';

// Shared radial glow texture
const glowTex = (() => {
  const sz = 128;
  const c = document.createElement('canvas');
  c.width = c.height = sz;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
  g.addColorStop(0,   'rgba(255,230,140,1)');
  g.addColorStop(0.2, 'rgba(255,200, 80,0.85)');
  g.addColorStop(0.5, 'rgba(255,140, 20,0.4)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(c);
})();

function GlowBlock({ entry }: { entry: GlowEntry }) {
  const spriteRef = useRef<THREE.Sprite>(null!);
  const phase = useRef(Math.random() * Math.PI * 2);

  const mat = useMemo(() => new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xffcc44,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.85,
  }), []);

  useFrame(() => {
    const t = performance.now() * 0.001 + phase.current;
    // Very subtle shimmer — glowstone face brightness and block-light BFS
    // on neighbouring chunks is what actually lights the area (Minecraft style)
    const pulse = 1 + Math.sin(t * 3.1) * 0.06 + Math.sin(t * 7.3) * 0.03;
    const s = pulse * 0.5;
    spriteRef.current.scale.set(s, s, s);
    mat.opacity = 0.25 + Math.sin(t * 4.7) * 0.06;
  });

  return (
    <sprite
      ref={spriteRef}
      material={mat}
      position={[entry.x + 0.5, entry.y + 0.5, entry.z + 0.5]}
    />
  );
}

export function GlowSprites() {
  const glowstones = useWorldStore(s => s.glowstones);
  return (
    <>
      {glowstones.map(g => (
        <GlowBlock key={`${g.x},${g.y},${g.z}`} entry={g} />
      ))}
    </>
  );
}
