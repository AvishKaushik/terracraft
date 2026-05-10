import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/shallow';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { getInterpolated } from '../lib/interpolation';

const HAIR_COLOR = 0x3d1f00;

// Cache face textures by skin color so we don't rebuild for repeated skin colors
const faceTexCache = new Map<string, THREE.CanvasTexture>();

function buildFaceTex(skinColor: string): THREE.CanvasTexture {
  if (faceTexCache.has(skinColor)) return faceTexCache.get(skinColor)!;
  const sz  = 64;
  const c   = document.createElement('canvas');
  c.width   = c.height = sz;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = skinColor;
  ctx.fillRect(0, 0, sz, sz);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(9, 18, 16, 16); ctx.fillRect(39, 18, 16, 16);
  ctx.fillStyle = '#3a7abf';
  ctx.fillRect(11, 20, 12, 12); ctx.fillRect(41, 20, 12, 12);
  ctx.fillStyle = '#111111';
  ctx.fillRect(14, 23, 6, 6); ctx.fillRect(44, 23, 6, 6);
  ctx.fillStyle = '#c8905a';
  ctx.fillRect(27, 33, 10, 6); ctx.fillRect(21, 38, 6, 4); ctx.fillRect(37, 38, 6, 4);
  ctx.fillStyle = '#7a2e08';
  ctx.fillRect(17, 48, 30, 5); ctx.fillRect(17, 53, 8, 4); ctx.fillRect(39, 53, 8, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  faceTexCache.set(skinColor, tex);
  return tex;
}

function makeHeadMats(skinColor: string): THREE.MeshBasicMaterial[] {
  const skinHex = new THREE.Color(skinColor).getHex();
  return [
    new THREE.MeshBasicMaterial({ color: skinHex }),                   // +X
    new THREE.MeshBasicMaterial({ color: skinHex }),                   // -X
    new THREE.MeshBasicMaterial({ color: HAIR_COLOR }),                // +Y hair
    new THREE.MeshBasicMaterial({ color: skinHex }),                   // -Y
    new THREE.MeshBasicMaterial({ map: buildFaceTex(skinColor) }),     // +Z face
    new THREE.MeshBasicMaterial({ color: HAIR_COLOR }),                // -Z hair
  ];
}

// ── Single remote player ──────────────────────────────────────────────────────
function RemotePlayerMesh({ id }: { id: string }) {
  const groupRef    = useRef<THREE.Group>(null!);
  const headRef     = useRef<THREE.Group>(null!);
  const leftArmRef  = useRef<THREE.Group>(null!);
  const rightArmRef = useRef<THREE.Group>(null!);
  const leftLegRef  = useRef<THREE.Group>(null!);
  const rightLegRef = useRef<THREE.Group>(null!);

  const walkPhase = useRef(0);
  const lastPos   = useRef(new THREE.Vector3());

  const player = useMultiplayerStore(s => s.players.get(id));
  const name       = player?.name       ?? id;
  const skinColor  = player?.skinColor  ?? '#f4c07a';
  const shirtColor = player?.shirtColor ?? '#3a5fa0';
  const pantsColor = player?.pantsColor ?? '#1e3a5f';

  const headMats = useMemo(() => makeHeadMats(skinColor),  [skinColor]);
  const shirtMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(shirtColor).getHex() }), [shirtColor]);
  const pantsMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(pantsColor).getHex() }), [pantsColor]);
  const skinMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(skinColor).getHex()  }), [skinColor]);

  useFrame(() => {
    const result = getInterpolated(id);
    if (!result) return;

    const { pos, yaw, pitch } = result;

    // Estimate movement speed for walk animation
    const dx = pos.x - lastPos.current.x;
    const dz = pos.z - lastPos.current.z;
    const speed = Math.sqrt(dx * dx + dz * dz) * 60; // approx blocks/s
    lastPos.current.copy(pos);

    groupRef.current.position.copy(pos);
    groupRef.current.rotation.y = yaw + Math.PI;

    // Negate pitch: the body group is rotated π around Y, which flips the local X axis,
    // so the same sign would appear inverted to observers.
    headRef.current.rotation.x = -pitch;

    // Limb swing proportional to speed
    walkPhase.current += speed * 0.13;
    const swing = Math.sin(walkPhase.current) * Math.min(speed * 0.35, 1) * 0.7;

    leftArmRef.current.rotation.x  =  swing;
    rightArmRef.current.rotation.x = -swing;
    leftLegRef.current.rotation.x  = -swing;
    rightLegRef.current.rotation.x  =  swing;
  });

  return (
    <group ref={groupRef}>

      {/* Head — pivot at neck (y = 1.5), box is 0.5 tall so centre at y = 1.75 */}
      <group ref={headRef} position={[0, 1.5, 0]}>
        <mesh position={[0, 0.25, 0]} material={headMats}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
        </mesh>
      </group>

      {/* Body (torso) */}
      <mesh position={[0, 1.125, 0]} material={shirtMat}>
        <boxGeometry args={[0.5, 0.75, 0.25]} />
      </mesh>

      {/* Left arm — pivot at left shoulder (y = 1.5) */}
      <group ref={leftArmRef} position={[-0.375, 1.5, 0]}>
        <mesh position={[0, -0.35, 0]} material={shirtMat}>
          <boxGeometry args={[0.25, 0.65, 0.25]} />
        </mesh>
        {/* hand / wrist */}
        <mesh position={[0, -0.72, 0]} material={skinMat}>
          <boxGeometry args={[0.25, 0.08, 0.25]} />
        </mesh>
      </group>

      {/* Right arm — pivot at right shoulder (y = 1.5) */}
      <group ref={rightArmRef} position={[0.375, 1.5, 0]}>
        <mesh position={[0, -0.35, 0]} material={shirtMat}>
          <boxGeometry args={[0.25, 0.65, 0.25]} />
        </mesh>
        <mesh position={[0, -0.72, 0]} material={skinMat}>
          <boxGeometry args={[0.25, 0.08, 0.25]} />
        </mesh>
      </group>

      {/* Left leg — pivot at left hip (y = 0.75) */}
      <group ref={leftLegRef} position={[-0.125, 0.75, 0]}>
        <mesh position={[0, -0.375, 0]} material={pantsMat}>
          <boxGeometry args={[0.25, 0.75, 0.25]} />
        </mesh>
      </group>

      {/* Right leg — pivot at right hip (y = 0.75) */}
      <group ref={rightLegRef} position={[0.125, 0.75, 0]}>
        <mesh position={[0, -0.375, 0]} material={pantsMat}>
          <boxGeometry args={[0.25, 0.75, 0.25]} />
        </mesh>
      </group>

      {/* Nametag */}
      <Html position={[0, 2.25, 0]} center distanceFactor={12} zIndexRange={[0, 0]}>
        <div className="nametag">{name}</div>
      </Html>
    </group>
  );
}

// ── Scene root ────────────────────────────────────────────────────────────────
export function OtherPlayers() {
  const ids = useMultiplayerStore(useShallow(s => s.playerIds));
  return <>{ids.map(id => <RemotePlayerMesh key={id} id={id} />)}</>;
}
