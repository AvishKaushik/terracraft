import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';

// Offset in camera space: slightly right, below centre, close to near plane
const CAMERA_OFFSET = new THREE.Vector3(0.28, -0.26, -0.48);

function buildGlowTex(): THREE.CanvasTexture {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0,   'rgba(255, 220, 100, 1)');
  grad.addColorStop(0.3, 'rgba(255, 130,  20, 0.6)');
  grad.addColorStop(1,   'rgba(0,     0,   0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export function HeldTorch() {
  const { camera } = useThree();
  const started       = useGameStore(s => s.started);
  const chatOpen      = useGameStore(s => s.chatOpen);
  const inventoryOpen = useGameStore(s => s.inventoryOpen);
  const hotbar        = useGameStore(s => s.hotbar);
  const currentSlot   = useGameStore(s => s.currentSlot);
  const mouseLocked   = useGameStore(s => s.mouseLocked);

  // Imperative refs for camera-attached objects
  const groupRef = useRef<THREE.Group | null>(null);
  const flameRef = useRef<THREE.Mesh | null>(null);
  const glowRef  = useRef<THREE.Sprite | null>(null);
  const phase    = useRef(Math.random() * Math.PI * 2);

  // Build the torch model once and attach it to the camera
  useEffect(() => {
    // Stick — thin box, tilted naturally in hand
    const stickGeo = new THREE.BoxGeometry(0.028, 0.25, 0.028);
    const stickMat = new THREE.MeshBasicMaterial({ color: 0x8b5a2b, depthTest: false });
    const stick = new THREE.Mesh(stickGeo, stickMat);
    stick.rotation.set(0.22, 0.15, -0.12);
    stick.position.set(0, -0.01, 0);
    stick.renderOrder = 999;

    // Flame
    const flameGeo = new THREE.SphereGeometry(0.021, 7, 7);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xff9900, depthTest: false });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.rotation.set(0.18, 0, -0.10);
    flame.position.set(-0.012, 0.135, 0);
    flame.renderOrder = 999;
    flameRef.current = flame;

    // Bright inner core
    const coreGeo = new THREE.SphereGeometry(0.011, 6, 6);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffe060, depthTest: false });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(-0.012, 0.137, 0);
    core.renderOrder = 999;

    // Glow halo
    const glowTex = buildGlowTex();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex, color: 0xff8800,
      transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, opacity: 0.75,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(-0.012, 0.135, 0);
    glow.scale.setScalar(0.11);
    glow.renderOrder = 999;
    glowRef.current = glow;

    const group = new THREE.Group();
    group.position.copy(CAMERA_OFFSET);
    group.add(stick, flame, core, glow);
    group.visible = false;
    groupRef.current = group;

    camera.add(group);

    return () => {
      camera.remove(group);
      stickGeo.dispose(); stickMat.dispose();
      flameGeo.dispose(); flameMat.dispose();
      coreGeo.dispose();  coreMat.dispose();
      glowTex.dispose();  glowMat.dispose();
      groupRef.current = null;
      flameRef.current = null;
      glowRef.current  = null;
    };
  // run once — camera reference is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  // Toggle visibility whenever game state changes
  useEffect(() => {
    if (!groupRef.current) return;
    const isTorch = hotbar[currentSlot] === 15;
    groupRef.current.visible = isTorch && started && mouseLocked && !chatOpen && !inventoryOpen;
  }, [hotbar, currentSlot, started, chatOpen, inventoryOpen, mouseLocked]);

  // Animate flame flicker + subtle hand bob
  useFrame(({ clock }) => {
    if (!groupRef.current?.visible) return;
    const t = clock.getElapsedTime() + phase.current;

    // Flicker
    const flicker = 1 + Math.sin(t * 7.3) * 0.14 + Math.sin(t * 13.7) * 0.06;
    flameRef.current!.scale.setScalar(flicker);
    glowRef.current!.scale.setScalar(flicker * 0.11);
    (glowRef.current!.material as THREE.SpriteMaterial).opacity =
      0.6 + Math.sin(t * 9.1) * 0.18;

    // Gentle idle bob on the group
    groupRef.current!.position.y = CAMERA_OFFSET.y + Math.sin(t * 1.8) * 0.004;
    groupRef.current!.position.x = CAMERA_OFFSET.x + Math.sin(t * 0.9) * 0.002;
  });

  return null; // all rendering done via camera.add
}
