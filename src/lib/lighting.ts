import { WORLD_W, WORLD_H, WORLD_D } from './constants';
import { BLOCKS } from './blocks';
import { blockIndex, inBounds } from './terrain';

const DIRS6: [number, number, number][] = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];

export function computeLightMap(
  world: Uint8Array,
  lightMap: Uint8Array,
  skyLightMap: Uint8Array,
  blockLightMap: Uint8Array,
): void {
  const size = WORLD_W * WORLD_H * WORLD_D;
  for (let i = 0; i < size; i++) { skyLightMap[i] = 0; blockLightMap[i] = 0; }

  // 1. Sky light only — column propagation downward
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      let sky = 15;
      for (let y = WORLD_H - 1; y >= 0; y--) {
        const idx = blockIndex(x, y, z);
        const id = world[idx];
        if (id === 0 || BLOCKS[id]?.sprite) {
          skyLightMap[idx] = sky;
        } else if (BLOCKS[id]?.transparent) {
          sky = Math.max(0, sky - 1);
          skyLightMap[idx] = sky;
        } else {
          sky = 0;
        }
      }
    }
  }

  // 2. Block light only — BFS from emitting blocks
  const queue: number[] = [];
  for (let i = 0; i < size; i++) {
    const id = world[i];
    if (!id) continue;
    const emit = BLOCKS[id]?.emitLight ?? 0;
    if (emit > 0) {
      blockLightMap[i] = emit;
      queue.push(i);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const cl = blockLightMap[idx];
    if (cl <= 1) continue;

    const yy = Math.floor(idx / (WORLD_D * WORLD_W));
    const rem = idx - yy * WORLD_D * WORLD_W;
    const zz = Math.floor(rem / WORLD_W);
    const xx = rem % WORLD_W;

    for (const [dx, dy, dz] of DIRS6) {
      const nx = xx + dx, ny = yy + dy, nz = zz + dz;
      if (!inBounds(nx, ny, nz)) continue;
      const nidx = blockIndex(nx, ny, nz);
      const nid = world[nidx];
      if (nid !== 0 && !BLOCKS[nid]?.transparent && !BLOCKS[nid]?.sprite) continue;
      const nl = cl - 1;
      if (nl > blockLightMap[nidx]) {
        blockLightMap[nidx] = nl;
        queue.push(nidx);
      }
    }
  }

  // 3. Combined map (used for legacy / collision callers)
  for (let i = 0; i < size; i++) {
    lightMap[i] = Math.max(skyLightMap[i], blockLightMap[i]);
  }
}
