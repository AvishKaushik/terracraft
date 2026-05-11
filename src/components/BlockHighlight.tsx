import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { usePlayerStore } from '../stores/playerStore';
import { useWorldStore } from '../stores/worldStore';
import { useGameStore } from '../stores/gameStore';
import { raycastBlock } from '../lib/raycast';

const _pos = new THREE.Vector3();

export function BlockHighlight() {
  const lineRef = useRef<THREE.LineSegments>(null!);
  const tintRef = useRef<THREE.Mesh>(null!);

  const edgesGeom = useMemo(() =>
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)), []);
  const lineMat = useMemo(() =>
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7, fog: false }), []);

  const tintGeom = useMemo(() => new THREE.BoxGeometry(1.001, 1.001, 1.001), []);
  const tintMat  = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.18,
    depthWrite: false, polygonOffset: true,
    polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    fog: false,
  }), []);

  useFrame(() => {
    const { pos, yaw, pitch } = usePlayerStore.getState();
    const { world } = useWorldStore.getState();
    const { started, mouseLocked } = useGameStore.getState();
    const visible = started && mouseLocked;
    if (!visible) {
      lineRef.current.visible = false;
      tintRef.current.visible = false;
      return;
    }

    _pos.set(...pos);
    const hit = raycastBlock(_pos, yaw, pitch, world);
    if (hit) {
      lineRef.current.visible = true;
      tintRef.current.visible = true;
      lineRef.current.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      tintRef.current.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      lineRef.current.visible = false;
      tintRef.current.visible = false;
    }
  });

  return (
    <>
      <lineSegments ref={lineRef} args={[edgesGeom, lineMat]} visible={false} />
      <mesh ref={tintRef} geometry={tintGeom} material={tintMat} visible={false} />
    </>
  );
}
