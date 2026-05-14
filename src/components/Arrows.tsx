import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { activeArrows } from '../lib/arrows';

const _dir = new THREE.Vector3();
const _up  = new THREE.Vector3(0, 0, 1);

export function Arrows() {
  const groupRef  = useRef<THREE.Group>(null!);
  const meshMap   = useRef(new Map<string, THREE.Group>());

  const shaftGeo  = useMemo(() => new THREE.BoxGeometry(0.05, 0.05, 0.55), []);
  const shaftMat  = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x7b4f18 }), []);
  const fletchGeo = useMemo(() => new THREE.BoxGeometry(0.14, 0.14, 0.14), []);
  const fletchMat = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xe8e4c8 }), []);

  useFrame(() => {
    const now   = performance.now() / 1000;
    const group = groupRef.current;
    if (!group) return;

    // Expire finished arrows
    for (const [id, arrow] of activeArrows) {
      if (now - arrow.startTime > arrow.duration + 0.5) {
        const m = meshMap.current.get(id);
        if (m) group.remove(m);
        meshMap.current.delete(id);
        activeArrows.delete(id);
      }
    }

    // Create or update each active arrow
    for (const [id, arrow] of activeArrows) {
      let arrowGroup = meshMap.current.get(id);
      if (!arrowGroup) {
        arrowGroup = new THREE.Group();
        const shaft   = new THREE.Mesh(shaftGeo, shaftMat);
        const fletching = new THREE.Mesh(fletchGeo, fletchMat);
        fletching.position.z = -0.22;
        arrowGroup.add(shaft, fletching);
        group.add(arrowGroup);
        meshMap.current.set(id, arrowGroup);
      }

      // Position: lerp from→to with slight arc
      const t = Math.min(1, (now - arrow.startTime) / arrow.duration);
      const arc = Math.sin(t * Math.PI) * 0.4; // rises then falls
      arrowGroup.position.set(
        arrow.from[0] + (arrow.to[0] - arrow.from[0]) * t,
        arrow.from[1] + (arrow.to[1] - arrow.from[1]) * t + arc,
        arrow.from[2] + (arrow.to[2] - arrow.from[2]) * t,
      );

      // Orient along travel direction
      _dir.set(
        arrow.to[0] - arrow.from[0],
        arrow.to[1] - arrow.from[1],
        arrow.to[2] - arrow.from[2],
      ).normalize();
      if (_dir.lengthSq() > 0.001) {
        arrowGroup.quaternion.setFromUnitVectors(_up, _dir);
      }
    }
  });

  return <group ref={groupRef} />;
}
