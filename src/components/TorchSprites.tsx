/**
 * TorchSprites — renders every placed torch as a standalone 3D object.
 * Completely decoupled from the voxel chunk mesher.
 * Driven by explicit `torches` state in worldStore (not chunk scanning).
 */
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useWorldStore, type TorchEntry } from '../stores/worldStore';

// ── Glow halo texture (one shared canvas texture) ─────────────────────────────
const glowTex = (() => {
  const sz = 64;
  const c = document.createElement('canvas');
  c.width = c.height = sz;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(sz/2, sz/2, 0, sz/2, sz/2, sz/2);
  g.addColorStop(0,    'rgba(255,220,100,1)');
  g.addColorStop(0.3,  'rgba(255,140, 30,0.75)');
  g.addColorStop(0.7,  'rgba(255, 60,  0,0.2)');
  g.addColorStop(1,    'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, sz, sz);
  return new THREE.CanvasTexture(c);
})();

// ── Tilt angle for wall-mounted torches (radians) ─────────────────────────────
const WALL_TILT = Math.PI / 6; // 30°

// ── One torch object ──────────────────────────────────────────────────────────
function TorchObject({ entry }: { entry: TorchEntry }) {
  const flameRef   = useRef<THREE.Mesh>(null!);
  const glowRef    = useRef<THREE.Sprite>(null!);
  const phase      = useRef(Math.random() * Math.PI * 2);

  // Tiny inner glow — just a warm shimmer right at the flame, not a big halo
  const glowMat = useMemo(() => new THREE.SpriteMaterial({
    map: glowTex, color: 0xff8800,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.55,
  }), []);

  useFrame(() => {
    const t = performance.now() * 0.001 + phase.current;
    const f = 1 + Math.sin(t * 7.1) * 0.14 + Math.sin(t * 13.3) * 0.07;
    flameRef.current.scale.setScalar(f);
    // Keep the sprite tiny — just indicates a flame, surrounding block
    // brightness comes from baked vertex light in the chunk mesh
    const gs = f * 0.38;
    glowRef.current.scale.set(gs, gs, gs);
    glowMat.opacity = 0.38 + Math.sin(t * 9.5) * 0.10;
  });

  // ── Placement transform ────────────────────────────────────────────────────
  const { groupPos, groupRot } = useMemo(() => {
    const { x, y, z, face: [fx, fy, fz] } = entry;
    const cx = x + 0.5;
    const cz = z + 0.5;

    if (fy === 1) {
      // Standing on ground — vertical, base at block bottom
      return {
        groupPos: new THREE.Vector3(cx, y, cz),
        groupRot: new THREE.Euler(0, 0, 0),
      };
    }
    // Wall torch — offset base toward wall, tilt away from wall
    const offX = fx !== 0 ? -fx * 0.3 : 0;
    const offZ = fz !== 0 ? -fz * 0.3 : 0;
    // rotX: fz wall → tilt along X; rotZ: fx wall → tilt along Z
    const rotX = -fz * WALL_TILT;
    const rotZ =  fx * WALL_TILT;
    return {
      groupPos: new THREE.Vector3(cx + offX, y + 0.45, cz + offZ),
      groupRot: new THREE.Euler(rotX, 0, rotZ),
    };
  }, [entry]);

  return (
    <group position={groupPos} rotation={groupRot}>
      {/* ── Stick: two thin crossing boxes ── */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.09, 0.56, 0.025]} />
        <meshBasicMaterial color={0x8b5a2b} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[0.025, 0.56, 0.09]} />
        <meshBasicMaterial color={0x7a4e24} />
      </mesh>

      {/* ── Flame knob ── */}
      <mesh ref={flameRef} position={[0, 0.62, 0]}>
        <sphereGeometry args={[0.065, 8, 8]} />
        <meshBasicMaterial color={0xff9200} />
      </mesh>

      {/* ── Bright inner core ── */}
      <mesh position={[0, 0.63, 0]}>
        <sphereGeometry args={[0.032, 6, 6]} />
        <meshBasicMaterial color={0xffe060} />
      </mesh>

      {/* ── Additive glow halo — brighter at night ── */}
      <sprite ref={glowRef} material={glowMat} position={[0, 0.63, 0]} />
    </group>
  );
}

// ── Scene root: driven by explicit React state ────────────────────────────────
export function TorchSprites() {
  const torches = useWorldStore(s => s.torches);
  return (
    <>
      {torches.map(t => (
        <TorchObject key={`${t.x},${t.y},${t.z}`} entry={t} />
      ))}
    </>
  );
}
