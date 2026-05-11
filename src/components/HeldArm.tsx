import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';
import { SPRINT_SPEED } from '../lib/constants';

const BASE = new THREE.Vector3(0.30, -0.22, -0.44);
const BASE_ROT_X = -0.40;
const SWING_DUR  = 0.20; // seconds for a full punch swing

export function HeldArm() {
  const { camera } = useThree();
  const started       = useGameStore(s => s.started);
  const mouseLocked   = useGameStore(s => s.mouseLocked);
  const chatOpen      = useGameStore(s => s.chatOpen);
  const inventoryOpen = useGameStore(s => s.inventoryOpen);
  const user          = useAuthStore(s => s.user);

  const groupRef  = useRef<THREE.Group | null>(null);
  const swingRef  = useRef(0);          // counts down from SWING_DUR to 0
  const sprintRef = useRef(0);          // lerped sprint factor 0–1

  // Rebuild arm geometry/colors whenever avatar colors change
  useEffect(() => {
    const skinHex  = new THREE.Color(user?.skinColor  ?? '#f4c07a').getHex();
    const shirtHex = new THREE.Color(user?.shirtColor ?? '#3a5fa0').getHex();

    const mk = (w: number, h: number, d: number, color: number) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color, depthTest: false }),
      );
      m.renderOrder = 995;
      return m;
    };

    const wrist  = mk(0.14, 0.09, 0.14, skinHex);
    wrist.position.set(0, 0, 0);

    const fore   = mk(0.13, 0.35, 0.13, skinHex);
    fore.position.set(0, -0.22, 0.02);

    const sleeve = mk(0.155, 0.24, 0.155, shirtHex);
    sleeve.position.set(0, -0.505, 0.045);

    // Dispose old group if it exists
    if (groupRef.current) {
      groupRef.current.children.forEach(c => {
        const m = c as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      camera.remove(groupRef.current);
    }

    const group = new THREE.Group();
    group.position.copy(BASE);
    group.rotation.set(BASE_ROT_X, 0, -0.08);
    group.add(wrist, fore, sleeve);
    group.visible = false;
    groupRef.current = group;
    camera.add(group);

    return () => {
      camera.remove(group);
      [wrist, fore, sleeve].forEach(m => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      groupRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.skinColor, user?.shirtColor]);

  // Show/hide arm based on game state
  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = started && mouseLocked && !chatOpen && !inventoryOpen;
  }, [started, mouseLocked, chatOpen, inventoryOpen]);

  // Swing on left click
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement) {
        swingRef.current = SWING_DUR;
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  useFrame((_s, dt) => {
    const g = groupRef.current;
    if (!g?.visible) return;

    const t   = performance.now() / 1000;
    const vel = usePlayerStore.getState().vel;
    const hSpeed  = Math.hypot(vel[0], vel[2]);
    const walkAmt = Math.min(hSpeed / 5, 1);

    // Idle breathing
    const idleBob = Math.sin(t * 1.6) * 0.003;

    // Walk bob + swing
    const phase    = t * 7.5;
    const walkBob  = Math.abs(Math.sin(phase)) * -0.014 * walkAmt;
    const walkSwing = Math.sin(phase) * 0.10 * walkAmt;
    const walkPush  = Math.sin(phase) * 0.016 * walkAmt;

    // Sprint lean — lerp smoothly in/out
    const sprintTarget = hSpeed > SPRINT_SPEED * 0.75 ? 1 : 0;
    sprintRef.current += (sprintTarget - sprintRef.current) * Math.min(1, 9 * dt);
    const sl = sprintRef.current;

    // Punch swing — bell curve over SWING_DUR
    if (swingRef.current > 0) swingRef.current = Math.max(0, swingRef.current - dt);
    const swingProgress = swingRef.current > 0 ? (SWING_DUR - swingRef.current) / SWING_DUR : 0;
    const swingT = Math.sin(swingProgress * Math.PI); // 0→1→0 bell curve

    g.position.x = BASE.x;
    g.position.y = BASE.y + idleBob + walkBob - swingT * 0.055 - sl * 0.02;
    g.position.z = BASE.z + walkPush + swingT * 0.035 + sl * 0.035;

    g.rotation.x = BASE_ROT_X + walkSwing + swingT * 1.0 - sl * 0.18;
    g.rotation.z = -0.08 + sl * 0.04;
  });

  return null;
}
