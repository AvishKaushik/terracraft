import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useShallow } from 'zustand/shallow';
import { useDroppedItemsStore, type DroppedCluster } from '../stores/droppedItemsStore';
import { BLOCK_DEFS } from '../lib/blocks';
import { ITEMS } from '../lib/items';

const ITEM_COLORS: Record<number, number> = {
  256: 0x8c6c3c, 257: 0x9a9078, 258: 0xb0c0c0, 259: 0x5ce8e8,
  260: 0x8c6c3c, 261: 0x9a9078, 262: 0xb0c0c0, 263: 0x5ce8e8,
  264: 0xd4a044, 265: 0xc04040,
  270: 0xb0c0c0, 271: 0xb0c0c0, 272: 0xb0c0c0, 273: 0xb0c0c0,
  274: 0x5ce8e8, 275: 0x5ce8e8, 276: 0x5ce8e8, 277: 0x5ce8e8,
  278: 0xeeeeee, 279: 0x333333, 280: 0x7c5c2c, 281: 0x888888,
};

function clusterColor(items: { id: number }[]): number {
  const first = items[0]?.id ?? 0;
  if (first >= 256) return ITEM_COLORS[first] ?? 0xaaaaaa;
  const def = BLOCK_DEFS[first];
  if (!def) return 0x888888;
  const tex = typeof def.tex === 'object' ? (def.tex as Record<string, number>).all ?? 0 : 0;
  // Map a few common block textures to rough colors
  const blockColors: Record<number, number> = {
    0: 0x5a8c3a, 1: 0x7a5c3a, 2: 0x888888, 3: 0x777777,
    4: 0xd4c080, 5: 0x5a8c3a, 6: 0x7c5c2c, 7: 0xd4d4c4,
  };
  return blockColors[tex] ?? 0xaaaaaa;
}

function ClusterMesh({ cluster }: { cluster: DroppedCluster }) {
  const groupRef = useRef<THREE.Group>(null!);
  const spin = useRef(Math.random() * Math.PI * 2);
  const bob  = useRef(Math.random() * Math.PI * 2);

  const color = useMemo(() => clusterColor(cluster.items), [cluster.items]);
  const mat   = useMemo(() => new THREE.MeshBasicMaterial({ color }), [color]);

  useFrame((_s, dt) => {
    const g = groupRef.current;
    if (!g) return;
    spin.current += dt * 1.8;
    bob.current  += dt * 2.2;
    g.rotation.y  = spin.current;
    g.position.y  = cluster.pos[1] + 0.3 + Math.sin(bob.current) * 0.08;
  });

  const label = cluster.items
    .map(it => {
      const name = it.id >= 256 ? (ITEMS[it.id]?.name ?? `Item ${it.id}`) : (BLOCK_DEFS[it.id]?.name ?? `Block ${it.id}`);
      return it.count > 1 ? `${name} ×${it.count}` : name;
    })
    .join(', ');

  return (
    <group ref={groupRef} position={[cluster.pos[0], cluster.pos[1] + 0.3, cluster.pos[2]]}>
      <mesh material={mat}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
      </mesh>
      <Html center distanceFactor={8} zIndexRange={[0, 0]} position={[0, 0.4, 0]}>
        <div style={{
          color: '#fff', fontSize: '10px', textShadow: '0 1px 2px #000',
          background: 'rgba(0,0,0,0.5)', padding: '1px 5px', borderRadius: '3px',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

export function DroppedItems() {
  const clusterIds = useDroppedItemsStore(useShallow(s => s.clusterIds));
  const clusters   = useDroppedItemsStore(s => s.clusters);
  return (
    <>
      {clusterIds.map(id => {
        const c = clusters.get(id);
        if (!c) return null;
        return <ClusterMesh key={id} cluster={c} />;
      })}
    </>
  );
}
