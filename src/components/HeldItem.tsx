import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { BLOCKS } from '../lib/blocks';
import { renderAtlasTile, renderItemIcon } from '../lib/blockIcon';
import { SPRINT_SPEED } from '../lib/constants';

// Camera-space origin of the held item (lower-right, in front of camera)
const ORIGIN = new THREE.Vector3(0.26, -0.26, -0.46);
const SWING_DUR = 0.20;

function tileMat(idx: number, tint: number, transparent = false): THREE.MeshBasicMaterial {
  const canvas = renderAtlasTile(idx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: new THREE.Color(tint, tint, tint),
    depthTest: false,
    transparent: transparent || tint < 1,
    alphaTest: transparent ? 0.1 : 0,
  });
  return mat;
}

function buildBlockMesh(blockId: number): THREE.Mesh {
  const block = BLOCKS[blockId];
  const topIdx  = block.tex.top  ?? block.tex.all!;
  const sideIdx = block.tex.side ?? block.tex.all!;
  const botIdx  = block.tex.bottom ?? block.tex.all!;
  const transp  = block.transparent ?? false;

  // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z
  const mats = [
    tileMat(sideIdx, 0.72, transp), // right
    tileMat(sideIdx, 0.72, transp), // left
    tileMat(topIdx,  1.00, transp), // top
    tileMat(botIdx,  0.55, transp), // bottom
    tileMat(sideIdx, 0.86, transp), // front
    tileMat(sideIdx, 0.60, transp), // back
  ];

  const geo  = new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const mesh = new THREE.Mesh(geo, mats);
  // Tilted like a block in Minecraft's hand (top + left face visible)
  mesh.rotation.set(0.45, -0.60, 0.25);
  mesh.frustumCulled = false;
  mesh.renderOrder = 997;
  return mesh;
}

function buildItemMesh(itemId: number): THREE.Mesh {
  const canvas = renderItemIcon(itemId);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, alphaTest: 0.05,
    side: THREE.DoubleSide, depthTest: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.38), mat);
  // Angle to look like it's held: tilted toward camera, slight diagonal
  mesh.rotation.set(-0.55, 0.20, 0.20);
  mesh.frustumCulled = false;
  mesh.renderOrder = 997;
  return mesh;
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach(m => {
    (m as THREE.MeshBasicMaterial).map?.dispose();
    m.dispose();
  });
}

export function HeldItem() {
  const { camera } = useThree();
  const hotbar      = useGameStore(s => s.hotbar);
  const currentSlot = useGameStore(s => s.currentSlot);
  const started     = useGameStore(s => s.started);
  const mouseLocked = useGameStore(s => s.mouseLocked);
  const chatOpen    = useGameStore(s => s.chatOpen);
  const inventoryOpen = useGameStore(s => s.inventoryOpen);

  const groupRef   = useRef<THREE.Group | null>(null);
  const meshRef    = useRef<THREE.Mesh | null>(null);
  const lastIdRef  = useRef(-1);
  const swingRef   = useRef(0);
  const sprintRef  = useRef(0);

  // Create group once, attach to camera
  useEffect(() => {
    const group = new THREE.Group();
    group.position.copy(ORIGIN);
    group.visible = false;
    groupRef.current = group;
    camera.add(group);
    return () => {
      if (meshRef.current) { disposeMesh(meshRef.current); meshRef.current = null; }
      camera.remove(group);
      groupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  // Show/hide
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    const id = hotbar[currentSlot]?.id ?? 0;
    const show = id !== 0 && id !== 15 && started && mouseLocked && !chatOpen && !inventoryOpen;
    g.visible = show;
  }, [hotbar, currentSlot, started, mouseLocked, chatOpen, inventoryOpen]);

  // Rebuild mesh when held ID changes
  useEffect(() => {
    const id = hotbar[currentSlot]?.id ?? 0;
    if (id === lastIdRef.current) return;
    lastIdRef.current = id;
    const g = groupRef.current;
    if (!g) return;

    if (meshRef.current) { g.remove(meshRef.current); disposeMesh(meshRef.current); meshRef.current = null; }
    if (id === 0 || id === 15) return;

    const mesh = id < 256 ? buildBlockMesh(id) : buildItemMesh(id);
    g.add(mesh);
    meshRef.current = mesh;
  }, [hotbar, currentSlot]);

  // Swing on left click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement) swingRef.current = SWING_DUR;
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  useFrame((_s, dt) => {
    const g = groupRef.current;
    if (!g?.visible) return;

    const vel = usePlayerStore.getState().vel;
    const hSpeed  = Math.hypot(vel[0], vel[2]);
    const walkAmt = Math.min(hSpeed / 5, 1);
    const t       = performance.now() / 1000;

    // Walk bob
    const phase   = t * 7.5;
    const walkBob = Math.abs(Math.sin(phase)) * -0.016 * walkAmt;
    const walkPush = Math.sin(phase) * 0.018 * walkAmt;

    // Sprint lean
    const sprintTarget = hSpeed > SPRINT_SPEED * 0.75 ? 1 : 0;
    sprintRef.current += (sprintTarget - sprintRef.current) * Math.min(1, 9 * dt);
    const sl = sprintRef.current;

    // Swing
    if (swingRef.current > 0) swingRef.current = Math.max(0, swingRef.current - dt);
    const swingProgress = swingRef.current > 0 ? (SWING_DUR - swingRef.current) / SWING_DUR : 0;
    const swingT = Math.sin(swingProgress * Math.PI);

    g.position.x = ORIGIN.x;
    g.position.y = ORIGIN.y + walkBob - swingT * 0.06 - sl * 0.02;
    g.position.z = ORIGIN.z + walkPush + swingT * 0.04 + sl * 0.03;

    // Rotate slightly during swing (down-arc punch)
    g.rotation.x = swingT * 0.6 - sl * 0.12;
    g.rotation.z = swingT * 0.15;
  });

  return null;
}
