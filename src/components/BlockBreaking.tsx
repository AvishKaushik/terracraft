import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { usePlayerStore } from '../stores/playerStore';
import { useWorldStore } from '../stores/worldStore';
import { useGameStore } from '../stores/gameStore';
import { raycastBlock } from '../lib/raycast';
import { BLOCKS } from '../lib/blocks';
import { ITEMS } from '../lib/items';
import { getBlockDrop, PICKAXE_BLOCKS } from '../lib/drops';
import { playBreak } from '../lib/sounds';
import { type BreakParticlesHandle } from './BreakParticles';
import { WORLD_W, WORLD_D, EYE_HEIGHT, REACH, PLAYER_WIDTH, PLAYER_HEIGHT } from '../lib/constants';
import { useMobStore, mobTargets, MOB_DEFS } from '../stores/mobStore';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { getInterpolated } from '../lib/interpolation';
import { socket } from '../lib/socket';
import { useQuestStore } from '../stores/questStore';

// Slab ray-AABB test — returns entry distance or null
function rayHitsAABB(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
  minX: number, maxX: number,
  minY: number, maxY: number,
  minZ: number, maxZ: number,
  maxDist: number,
): number | null {
  let tmin = 0, tmax = maxDist;
  for (const [o, d, lo, hi] of [[ox,dx,minX,maxX],[oy,dy,minY,maxY],[oz,dz,minZ,maxZ]] as const) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return null; continue; }
    const t1 = (lo - o) / d, t2 = (hi - o) / d;
    tmin = Math.max(tmin, Math.min(t1, t2));
    tmax = Math.min(tmax, Math.max(t1, t2));
  }
  return tmin <= tmax ? tmin : null;
}

interface Props {
  particlesRef: React.RefObject<BreakParticlesHandle>;
}

function makeCrackTexture(stage: number): THREE.CanvasTexture {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = `rgba(0,0,0,${stage * 0.07})`;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 1;

  const segs: [number, number, number, number][] = [
    [16, 16,  6,  4], [16, 16, 26,  6], [16, 16, 28, 22], [16, 16,  4, 26],
    [ 6,  4,  2, 12], [26,  6, 30, 14], [28, 22, 20, 30], [ 4, 26, 12, 30],
    [ 9, 10,  4, 16], [23, 10, 28, 16],
  ];

  for (let i = 0; i < Math.min(stage * 2, segs.length); i++) {
    ctx.beginPath();
    ctx.moveTo(segs[i][0], segs[i][1]);
    ctx.lineTo(segs[i][2], segs[i][3]);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

const _posVec = new THREE.Vector3();

export function BlockBreaking({ particlesRef }: Props) {
  const { gl } = useThree();
  const meshRef      = useRef<THREE.Mesh>(null!);
  const progressRef  = useRef(0);
  const targetRef    = useRef<{ x: number; y: number; z: number } | null>(null);
  const mouseDownRef = useRef(false);
  const lastStageRef = useRef(-1);

  const crackTextures = useMemo(() => [1, 2, 3, 4, 5].map(s => makeCrackTexture(s)), []);

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    map: crackTextures[0],
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: THREE.FrontSide,
  }), [crackTextures]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || !document.pointerLockElement) return;
      const { pos, yaw, pitch } = usePlayerStore.getState();
      const eyeX = pos[0], eyeY = pos[1] + EYE_HEIGHT, eyeZ = pos[2];
      const cosP = Math.cos(pitch);
      const rdx = -Math.sin(yaw) * cosP, rdy = Math.sin(pitch), rdz = -Math.cos(yaw) * cosP;

      let closestDist = REACH;
      let hitMobId: string | null = null;
      let hitPlayerId: string | null = null;

      // Check mobs
      for (const [id, t] of mobTargets) {
        const mob = useMobStore.getState().mobs.get(id);
        if (!mob) continue;
        const def = MOB_DEFS[mob.type];
        const hw = def.width / 2;
        const dist = rayHitsAABB(
          eyeX, eyeY, eyeZ, rdx, rdy, rdz,
          t.pos[0] - hw, t.pos[0] + hw,
          t.pos[1],      t.pos[1] + def.height,
          t.pos[2] - hw, t.pos[2] + hw,
          closestDist,
        );
        if (dist !== null && dist < closestDist) {
          closestDist = dist; hitMobId = id; hitPlayerId = null;
        }
      }

      // Check other players (PvP)
      const hw = PLAYER_WIDTH / 2;
      for (const pid of useMultiplayerStore.getState().playerIds) {
        const interp = getInterpolated(pid);
        if (!interp) continue;
        const dist = rayHitsAABB(
          eyeX, eyeY, eyeZ, rdx, rdy, rdz,
          interp.pos.x - hw, interp.pos.x + hw,
          interp.pos.y,      interp.pos.y + PLAYER_HEIGHT,
          interp.pos.z - hw, interp.pos.z + hw,
          closestDist,
        );
        if (dist !== null && dist < closestDist) {
          closestDist = dist; hitPlayerId = pid; hitMobId = null;
        }
      }

      const { currentSlot, hotbar } = useGameStore.getState();
      const slot2 = hotbar[currentSlot];
      const heldId    = slot2?.id ?? 0;
      const baseAtk   = heldId >= 256 ? (ITEMS[heldId]?.attackDamage ?? 1) : 1;
      const sharpness = slot2?.enchants?.Sharpness ?? 0;
      const attackDmg = baseAtk + sharpness * 2;

      if (hitMobId) {
        socket.emit('mob:hit', { id: hitMobId, damage: attackDmg });
        return;
      }
      if (hitPlayerId) {
        socket.emit('player:hit', { targetId: hitPlayerId, damage: attackDmg });
        return;
      }
      mouseDownRef.current = true;
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDownRef.current = false;
        progressRef.current  = 0;
        targetRef.current    = null;
      }
    };
    gl.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    return () => {
      gl.domElement.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, [gl.domElement]);

  useFrame((_s, rawDt) => {
    const { started, chatOpen, inventoryOpen, settingsOpen, chestOpen, furnaceOpen, enchantingOpen, brewingOpen } = useGameStore.getState();
    const dt = Math.min(rawDt, 0.1);

    if (!started || chatOpen || inventoryOpen || settingsOpen || chestOpen || furnaceOpen || enchantingOpen || brewingOpen ||
        !mouseDownRef.current || document.pointerLockElement !== gl.domElement) {
      meshRef.current.visible = false;
      if (!mouseDownRef.current) { progressRef.current = 0; targetRef.current = null; }
      return;
    }

    const { pos, yaw, pitch } = usePlayerStore.getState();
    const { world, setBlock }  = useWorldStore.getState();
    _posVec.set(...pos);
    const hit = raycastBlock(_posVec, yaw, pitch, world);

    if (!hit || hit.y === 0) {
      meshRef.current.visible = false;
      progressRef.current = 0;
      targetRef.current   = null;
      return;
    }

    const t = targetRef.current;
    if (!t || t.x !== hit.x || t.y !== hit.y || t.z !== hit.z) {
      progressRef.current = 0;
      targetRef.current   = { x: hit.x, y: hit.y, z: hit.z };
      lastStageRef.current = -1;
    }

    const blockId  = world[(hit.y * WORLD_D + hit.z) * WORLD_W + hit.x];
    const hardness = BLOCKS[blockId]?.hardness ?? 1;

    if (hardness === 0) {
      particlesRef.current?.spawn(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, blockId);
      playBreak();
      setBlock(hit.x, hit.y, hit.z, 0);
      useQuestStore.getState().reportBreak(blockId);
      const drop = getBlockDrop(blockId);
      if (drop) useGameStore.getState().addToHotbar(drop.id, drop.count);
      progressRef.current  = 0;
      targetRef.current    = null;
      meshRef.current.visible = false;
      return;
    }

    if (hardness >= 999) {
      meshRef.current.visible = false;
      return;
    }

    // Tool speed multiplier + efficiency enchant
    const { currentSlot, hotbar } = useGameStore.getState();
    const slotData = hotbar[currentSlot];
    const heldId = slotData?.id ?? 0;
    const heldItem = heldId >= 256 ? ITEMS[heldId] : null;
    const efficiency = slotData?.enchants?.Efficiency ?? 0;
    const baseSpeed = (heldItem?.speedMult && PICKAXE_BLOCKS.has(blockId)) ? heldItem.speedMult : 1;
    const speedMult = baseSpeed * (1 + efficiency * 0.3);

    progressRef.current += dt * speedMult;
    const frac  = Math.min(progressRef.current / hardness, 1);
    const stage = Math.min(Math.floor(frac * 5), 4);

    meshRef.current.visible = true;
    meshRef.current.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);

    if (stage !== lastStageRef.current) {
      mat.map = crackTextures[stage];
      mat.needsUpdate   = true;
      lastStageRef.current = stage;
    }

    if (frac >= 1) {
      particlesRef.current?.spawn(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, blockId);
      playBreak();
      setBlock(hit.x, hit.y, hit.z, 0);
      useQuestStore.getState().reportBreak(blockId);
      const drop = getBlockDrop(blockId);
      if (drop) useGameStore.getState().addToHotbar(drop.id, drop.count);
      if (blockId === 42) useGameStore.getState().addToHotbar(283, 1 + Math.floor(Math.random() * 2));
      progressRef.current  = 0;
      targetRef.current    = null;
      meshRef.current.visible = false;
    }
  });

  const boxGeom = useMemo(() => new THREE.BoxGeometry(1.003, 1.003, 1.003), []);

  return <mesh ref={meshRef} geometry={boxGeom} material={mat} visible={false} />;
}
