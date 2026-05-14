import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/shallow';
import { useMobStore, mobTargets, mobFusing, type MobType } from '../stores/mobStore';

// ── Shared materials per mob type (created once) ───────────────────────────

function useZombieMats() {
  return useMemo(() => ({
    skin:  new THREE.MeshBasicMaterial({ color: 0x5a8c3a }),
    shirt: new THREE.MeshBasicMaterial({ color: 0x2d5a20 }),
    pants: new THREE.MeshBasicMaterial({ color: 0x1a1a3a }),
  }), []);
}

function useCowMats() {
  return useMemo(() => ({
    body: new THREE.MeshBasicMaterial({ color: 0x6a3e1a }),
    leg:  new THREE.MeshBasicMaterial({ color: 0x3e2410 }),
    nose: new THREE.MeshBasicMaterial({ color: 0xd4a077 }),
  }), []);
}

function useSkeletonMats() {
  return useMemo(() => ({
    bone: new THREE.MeshBasicMaterial({ color: 0xd8d0b8 }),
    dark: new THREE.MeshBasicMaterial({ color: 0x9a9078 }),
    bow:  new THREE.MeshBasicMaterial({ color: 0x7c5c2c }),
  }), []);
}

function useCreeperMats() {
  return useMemo(() => ({
    body:  new THREE.MeshBasicMaterial({ color: 0x3a7a3a }),
    face:  new THREE.MeshBasicMaterial({ color: 0x1a4a1a }),
    flash: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
  }), []);
}

function useSpiderMats() {
  return useMemo(() => ({
    body: new THREE.MeshBasicMaterial({ color: 0x2a2a2a }),
    eye:  new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    leg:  new THREE.MeshBasicMaterial({ color: 0x1a1a1a }),
  }), []);
}

function useSlimeMats() {
  return useMemo(() => ({
    body: new THREE.MeshBasicMaterial({ color: 0x3a9a20, transparent: true, opacity: 0.85 }),
    dark: new THREE.MeshBasicMaterial({ color: 0x1a6010 }),
  }), []);
}

// ── Zombie body parts ──────────────────────────────────────────────────────

function ZombieBody({ mats }: { mats: ReturnType<typeof useZombieMats> }) {
  return (
    <>
      {/* Head */}
      <mesh position={[0, 1.65, 0]} material={mats.skin}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.1, 0]} material={mats.shirt}>
        <boxGeometry args={[0.55, 0.75, 0.3]} />
      </mesh>
      {/* Left arm — outstretched forward (~70° forward tilt) */}
      <group position={[-0.4, 1.48, 0]} rotation={[-Math.PI * 0.38, 0, 0]}>
        <mesh position={[0, -0.35, 0]} material={mats.shirt}>
          <boxGeometry args={[0.25, 0.7, 0.25]} />
        </mesh>
      </group>
      {/* Right arm */}
      <group position={[0.4, 1.48, 0]} rotation={[-Math.PI * 0.38, 0, 0]}>
        <mesh position={[0, -0.35, 0]} material={mats.shirt}>
          <boxGeometry args={[0.25, 0.7, 0.25]} />
        </mesh>
      </group>
    </>
  );
}

// ── Skeleton body parts ────────────────────────────────────────────────────

function SkeletonBody({ mats }: { mats: ReturnType<typeof useSkeletonMats> }) {
  return (
    <>
      {/* Head */}
      <mesh position={[0, 1.65, 0]} material={mats.bone}>
        <boxGeometry args={[0.48, 0.48, 0.48]} />
      </mesh>
      {/* Ribcage torso — thin */}
      <mesh position={[0, 1.1, 0]} material={mats.bone}>
        <boxGeometry args={[0.42, 0.60, 0.18]} />
      </mesh>
      {/* Spine detail */}
      <mesh position={[0, 1.1, 0]} material={mats.dark}>
        <boxGeometry args={[0.08, 0.60, 0.22]} />
      </mesh>
      {/* Left arm */}
      <group position={[-0.33, 1.42, 0]} rotation={[-0.15, 0, 0]}>
        <mesh position={[0, -0.28, 0]} material={mats.bone}>
          <boxGeometry args={[0.12, 0.55, 0.12]} />
        </mesh>
      </group>
      {/* Right arm — raised, holding bow */}
      <group position={[0.33, 1.42, 0]} rotation={[-0.55, 0, 0]}>
        <mesh position={[0, -0.28, 0]} material={mats.bone}>
          <boxGeometry args={[0.12, 0.55, 0.12]} />
        </mesh>
      </group>
      {/* Bow (held in right hand) */}
      <mesh position={[0.55, 1.3, -0.25]} material={mats.bow}>
        <boxGeometry args={[0.05, 0.65, 0.05]} />
      </mesh>
      {/* Bowstring */}
      <mesh position={[0.55, 1.3, -0.30]} material={mats.dark}>
        <boxGeometry args={[0.02, 0.55, 0.02]} />
      </mesh>
    </>
  );
}

// ── Creeper body parts ────────────────────────────────────────────────────

function CreeperBody({ mats }: { mats: ReturnType<typeof useCreeperMats> }) {
  return (
    <>
      {/* Head */}
      <mesh position={[0, 1.55, 0]} material={mats.body}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.13, 1.6, -0.26]} material={mats.face}>
        <boxGeometry args={[0.14, 0.12, 0.02]} />
      </mesh>
      <mesh position={[0.13, 1.6, -0.26]} material={mats.face}>
        <boxGeometry args={[0.14, 0.12, 0.02]} />
      </mesh>
      {/* Mouth */}
      <mesh position={[0, 1.45, -0.26]} material={mats.face}>
        <boxGeometry args={[0.2, 0.1, 0.02]} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.0, 0]} material={mats.body}>
        <boxGeometry args={[0.5, 0.6, 0.3]} />
      </mesh>
      {/* Flash overlay (whole body box, used for fuse flicker) */}
      <mesh position={[0, 1.05, 0]} material={mats.flash}>
        <boxGeometry args={[0.52, 1.3, 0.32]} />
      </mesh>
      {/* Front-left leg */}
      <mesh position={[-0.12, 0.4, -0.06]} material={mats.body}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      {/* Front-right leg */}
      <mesh position={[0.12, 0.4, -0.06]} material={mats.body}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      {/* Back-left leg */}
      <mesh position={[-0.12, 0.4, 0.1]} material={mats.body}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      {/* Back-right leg */}
      <mesh position={[0.12, 0.4, 0.1]} material={mats.body}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
    </>
  );
}

// ── Spider body parts ─────────────────────────────────────────────────────

function SpiderBody({ mats }: { mats: ReturnType<typeof useSpiderMats> }) {
  return (
    <>
      {/* Main abdomen */}
      <mesh position={[0, 0.3, 0.3]} material={mats.body}>
        <boxGeometry args={[0.7, 0.5, 0.8]} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.35, -0.28]} material={mats.body}>
        <boxGeometry args={[0.45, 0.38, 0.35]} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.1, 0.42, -0.46]} material={mats.eye}>
        <boxGeometry args={[0.1, 0.1, 0.04]} />
      </mesh>
      <mesh position={[0.1, 0.42, -0.46]} material={mats.eye}>
        <boxGeometry args={[0.1, 0.1, 0.04]} />
      </mesh>
      {/* 4 pairs of legs (8 total) */}
      {[-0.45, -0.15, 0.15, 0.45].map((z, i) => (
        <group key={i}>
          <mesh position={[-0.65, 0.15, z]} rotation={[0, 0, Math.PI * 0.15]} material={mats.leg}>
            <boxGeometry args={[0.7, 0.07, 0.07]} />
          </mesh>
          <mesh position={[0.65, 0.15, z]} rotation={[0, 0, -Math.PI * 0.15]} material={mats.leg}>
            <boxGeometry args={[0.7, 0.07, 0.07]} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ── Slime body parts ──────────────────────────────────────────────────────

function SlimeBody({ mats, size = 1 }: { mats: ReturnType<typeof useSlimeMats>; size?: number }) {
  const s = size;
  return (
    <>
      <mesh position={[0, s * 0.4, 0]} material={mats.body}>
        <boxGeometry args={[s * 0.8, s * 0.7, s * 0.8]} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-s * 0.16, s * 0.48, -s * 0.41]} material={mats.dark}>
        <boxGeometry args={[s * 0.14, s * 0.12, 0.04]} />
      </mesh>
      <mesh position={[s * 0.16, s * 0.48, -s * 0.41]} material={mats.dark}>
        <boxGeometry args={[s * 0.14, s * 0.12, 0.04]} />
      </mesh>
    </>
  );
}

// ── Cow body parts ─────────────────────────────────────────────────────────

function CowBody({ mats }: { mats: ReturnType<typeof useCowMats> }) {
  return (
    <>
      {/* Main body */}
      <mesh position={[0, 0.9, 0]} material={mats.body}>
        <boxGeometry args={[0.65, 0.65, 1.0]} />
      </mesh>
      {/* Head (forward) */}
      <mesh position={[0, 1.05, 0.62]} material={mats.body}>
        <boxGeometry args={[0.5, 0.48, 0.48]} />
      </mesh>
      {/* Nose */}
      <mesh position={[0, 0.97, 0.87]} material={mats.nose}>
        <boxGeometry args={[0.3, 0.22, 0.1]} />
      </mesh>
      {/* Front-left leg */}
      <mesh position={[-0.22, 0.38, 0.3]} material={mats.leg}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      {/* Front-right leg */}
      <mesh position={[0.22, 0.38, 0.3]} material={mats.leg}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      {/* Back-left leg */}
      <mesh position={[-0.22, 0.38, -0.3]} material={mats.leg}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
      {/* Back-right leg */}
      <mesh position={[0.22, 0.38, -0.3]} material={mats.leg}>
        <boxGeometry args={[0.2, 0.7, 0.2]} />
      </mesh>
    </>
  );
}

// ── Single mob ─────────────────────────────────────────────────────────────

function MobMesh({ id, type }: { id: string; type: MobType }) {
  const groupRef   = useRef<THREE.Group>(null!);
  const leftLegRef  = useRef<THREE.Mesh>(null!);
  const rightLegRef = useRef<THREE.Mesh>(null!);
  const walkPhase  = useRef(0);
  const prevPos    = useRef(new THREE.Vector3());

  const health    = useMobStore(s => s.mobs.get(id)?.health    ?? 1);
  const maxHealth = useMobStore(s => s.mobs.get(id)?.maxHealth ?? 1);
  const initPos   = useMobStore(s => s.mobs.get(id)?.pos ?? [0, 0, 0] as [number, number, number]);

  const zombieMats    = useZombieMats();
  const cowMats       = useCowMats();
  const skeletonMats  = useSkeletonMats();
  const creeperMats   = useCreeperMats();
  const spiderMats    = useSpiderMats();
  const slimeMats     = useSlimeMats();
  const fusePhase     = useRef(0);
  const bobPhase      = useRef(Math.random() * Math.PI * 2);

  useFrame((_s, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const t = mobTargets.get(id);
    if (!t) return;

    // Smooth position lerp
    const factor = Math.min(1, 14 * dt);
    g.position.x += (t.pos[0] - g.position.x) * factor;
    g.position.y += (t.pos[1] - g.position.y) * factor;
    g.position.z += (t.pos[2] - g.position.z) * factor;

    // Horizontal speed for walk animation
    const hSpeed = Math.hypot(
      g.position.x - prevPos.current.x,
      g.position.z - prevPos.current.z,
    ) / dt;
    prevPos.current.set(g.position.x, g.position.y, g.position.z);

    // Yaw lerp (shortest path)
    let yawDiff = t.yaw - g.rotation.y;
    if (yawDiff >  Math.PI) yawDiff -= 2 * Math.PI;
    if (yawDiff < -Math.PI) yawDiff += 2 * Math.PI;
    g.rotation.y += yawDiff * Math.min(1, 10 * dt);

    // Leg swing
    const walkAmt = Math.min(hSpeed / 3, 1);
    walkPhase.current += dt * 8 * walkAmt;
    const swing = Math.sin(walkPhase.current) * 0.6 * walkAmt;

    if (type === 'zombie' || type === 'skeleton') {
      if (leftLegRef.current)  leftLegRef.current.rotation.x  = -swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x =  swing;
    } else if (type === 'slime') {
      // Slime: squash and stretch bob
      bobPhase.current += dt * 3;
      g.scale.y = 1 + Math.abs(Math.sin(bobPhase.current)) * 0.15;
      g.scale.x = 1 - Math.abs(Math.sin(bobPhase.current)) * 0.08;
    } else if (type !== 'creeper' && type !== 'spider') {
      // Cow: gentle body bob
      g.position.y += Math.sin(walkPhase.current * 2) * 0.015 * walkAmt;
    }

    // Creeper fuse flash (5 Hz flicker)
    if (type === 'creeper') {
      const fusing = mobFusing.has(id);
      fusePhase.current = fusing ? fusePhase.current + dt * 10 : 0;
      const flash = fusing ? (Math.sin(fusePhase.current) > 0 ? 0.6 : 0) : 0;
      creeperMats.flash.opacity = flash;
    }
  });

  const healthPct = health / maxHealth;

  return (
    <group ref={groupRef} position={initPos}>
      {type === 'zombie' ? (
        <>
          <ZombieBody mats={zombieMats} />
          <group position={[-0.125, 0.75, 0]}>
            <mesh ref={leftLegRef} position={[0, -0.375, 0]} material={zombieMats.pants}>
              <boxGeometry args={[0.25, 0.75, 0.25]} />
            </mesh>
          </group>
          <group position={[0.125, 0.75, 0]}>
            <mesh ref={rightLegRef} position={[0, -0.375, 0]} material={zombieMats.pants}>
              <boxGeometry args={[0.25, 0.75, 0.25]} />
            </mesh>
          </group>
        </>
      ) : type === 'skeleton' ? (
        <>
          <SkeletonBody mats={skeletonMats} />
          <group position={[-0.1, 0.72, 0]}>
            <mesh ref={leftLegRef} position={[0, -0.34, 0]} material={skeletonMats.bone}>
              <boxGeometry args={[0.12, 0.68, 0.12]} />
            </mesh>
          </group>
          <group position={[0.1, 0.72, 0]}>
            <mesh ref={rightLegRef} position={[0, -0.34, 0]} material={skeletonMats.bone}>
              <boxGeometry args={[0.12, 0.68, 0.12]} />
            </mesh>
          </group>
        </>
      ) : type === 'creeper' ? (
        <>
          <CreeperBody mats={creeperMats} />
          <group position={[-0.1, 0.75, 0]}>
            <mesh ref={leftLegRef} position={[0, -0.375, 0]} material={creeperMats.body}>
              <boxGeometry args={[0.2, 0.75, 0.2]} />
            </mesh>
          </group>
          <group position={[0.1, 0.75, 0]}>
            <mesh ref={rightLegRef} position={[0, -0.375, 0]} material={creeperMats.body}>
              <boxGeometry args={[0.2, 0.75, 0.2]} />
            </mesh>
          </group>
        </>
      ) : type === 'spider' ? (
        <SpiderBody mats={spiderMats} />
      ) : type === 'slime' ? (
        <SlimeBody mats={slimeMats} />
      ) : (
        <CowBody mats={cowMats} />
      )}

      {/* Health bar */}
      <Html
        position={[0,
          type === 'zombie' || type === 'skeleton' ? 2.3
          : type === 'creeper' ? 2.2
          : type === 'spider' ? 1.1
          : type === 'slime' ? 1.2
          : 1.8, 0]}
        center
        distanceFactor={10}
        zIndexRange={[0, 0]}
      >
        <div className="mob-health-bar">
          <div
            className={`mob-health-fill${healthPct < 0.4 ? ' low' : ''}`}
            style={{ width: `${healthPct * 100}%` }}
          />
        </div>
      </Html>
    </group>
  );
}

// ── Scene root ─────────────────────────────────────────────────────────────

export function Mobs() {
  const mobIds = useMobStore(useShallow(s => s.mobIds));
  const mobs   = useMobStore(s => s.mobs);
  return (
    <>
      {mobIds.map(id => {
        const mob = mobs.get(id);
        if (!mob) return null;
        return <MobMesh key={id} id={id} type={mob.type} />;
      })}
    </>
  );
}
