import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { usePlayerStore } from '../stores/playerStore';
import { useWorldStore } from '../stores/worldStore';
import { useGameStore } from '../stores/gameStore';
import { raycastBlock } from '../lib/raycast';
import { BLOCKS } from '../lib/blocks';
import { playBreak } from '../lib/sounds';
import { type BreakParticlesHandle } from './BreakParticles';
import { WORLD_W, WORLD_D } from '../lib/constants';

interface Props {
  particlesRef: React.RefObject<BreakParticlesHandle>;
}

// Draw a crack texture for the given stage (1–5)
function makeCrackTexture(stage: number): THREE.CanvasTexture {
  const size = 32;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = `rgba(0,0,0,${stage * 0.07})`;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = 1;

  // Pre-defined crack segments; each stage reveals more
  const segs: [number, number, number, number][] = [
    [16, 16,  6,  4],
    [16, 16, 26,  6],
    [16, 16, 28, 22],
    [16, 16,  4, 26],
    [ 6,  4,  2, 12],
    [26,  6, 30, 14],
    [28, 22, 20, 30],
    [ 4, 26, 12, 30],
    [ 9, 10,  4, 16],
    [23, 10, 28, 16],
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
    const onDown = (e: MouseEvent) => { if (e.button === 0) mouseDownRef.current = true; };
    const onUp   = (e: MouseEvent) => {
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
    const { started, chatOpen, inventoryOpen, settingsOpen } = useGameStore.getState();
    const dt = Math.min(rawDt, 0.1);

    if (!started || chatOpen || inventoryOpen || settingsOpen ||
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

    // Reset if we've moved to a different block
    const t = targetRef.current;
    if (!t || t.x !== hit.x || t.y !== hit.y || t.z !== hit.z) {
      progressRef.current = 0;
      targetRef.current   = { x: hit.x, y: hit.y, z: hit.z };
      lastStageRef.current = -1;
    }

    const blockId  = world[(hit.y * WORLD_D + hit.z) * WORLD_W + hit.x];
    const hardness = BLOCKS[blockId]?.hardness ?? 1;

    // Instant break
    if (hardness === 0) {
      particlesRef.current?.spawn(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, blockId);
      playBreak();
      setBlock(hit.x, hit.y, hit.z, 0);
      progressRef.current  = 0;
      targetRef.current    = null;
      meshRef.current.visible = false;
      return;
    }

    // Unbreakable
    if (hardness >= 999) {
      meshRef.current.visible = false;
      return;
    }

    progressRef.current += dt;
    const frac  = Math.min(progressRef.current / hardness, 1);
    const stage = Math.min(Math.floor(frac * 5), 4); // 0–4

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
      progressRef.current  = 0;
      targetRef.current    = null;
      meshRef.current.visible = false;
    }
  });

  const boxGeom = useMemo(() => new THREE.BoxGeometry(1.003, 1.003, 1.003), []);

  return <mesh ref={meshRef} geometry={boxGeom} material={mat} visible={false} />;
}
