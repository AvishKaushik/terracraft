import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';

const BASE = new THREE.Vector3(0.30, -0.22, -0.44);

const SKIN   = 0xf4c07a;
const SLEEVE = 0x3a5fa0;

export function HeldArm() {
  const { camera } = useThree();
  const started       = useGameStore(s => s.started);
  const mouseLocked   = useGameStore(s => s.mouseLocked);
  const chatOpen      = useGameStore(s => s.chatOpen);
  const inventoryOpen = useGameStore(s => s.inventoryOpen);

  const groupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const mk = (w: number, h: number, d: number, color: number) => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshBasicMaterial({ color, depthTest: false }),
      );
      m.renderOrder = 995;
      return m;
    };

    // Wrist / hand knob — topmost visible part
    const wrist = mk(0.14, 0.09, 0.14, SKIN);
    wrist.position.set(0, 0, 0);

    // Forearm — skin coloured, extends downward
    const fore = mk(0.13, 0.35, 0.13, SKIN);
    fore.position.set(0, -0.22, 0.02);

    // Sleeve — shirt-blue, partially off screen
    const sleeve = mk(0.155, 0.24, 0.155, SLEEVE);
    sleeve.position.set(0, -0.505, 0.045);

    const group = new THREE.Group();
    group.position.copy(BASE);
    group.rotation.set(-0.40, 0, -0.08); // natural downward-right arm angle
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
  // camera ref is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.visible = started && mouseLocked && !chatOpen && !inventoryOpen;
  }, [started, mouseLocked, chatOpen, inventoryOpen]);

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g?.visible) return;

    const t = clock.getElapsedTime();
    const vel = usePlayerStore.getState().vel;
    const hSpeed = Math.hypot(vel[0], vel[2]);
    const walkAmt = Math.min(hSpeed / 5, 1);

    // Idle breathing
    const idleBob = Math.sin(t * 1.6) * 0.003;
    // Walk bob + swing
    const phase = t * 7.5;
    const walkBob   = Math.abs(Math.sin(phase)) * -0.014 * walkAmt;
    const walkSwing = Math.sin(phase) * 0.10 * walkAmt;
    const walkPush  = Math.sin(phase) * 0.016 * walkAmt;

    g.position.y = BASE.y + idleBob + walkBob;
    g.position.z = BASE.z + walkPush;
    g.rotation.x = -0.40 + walkSwing;
  });

  return null;
}
