import { WORLD_W, WORLD_H, WORLD_D, SEA_LEVEL } from './constants';

export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1000) / 1000;
  };
}

function hash2(x: number, z: number, seed: number): number {
  let h = (x * 374761393 + z * 668265263 + seed * 982451653) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix,     iz,     seed);
  const b = hash2(ix + 1, iz,     seed);
  const c = hash2(ix,     iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smoothstep(fx), v = smoothstep(fz);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, z: number, seed: number): number {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < 4; i++) {
    total += valueNoise(x * freq, z * freq, seed + i * 17) * amp;
    max += amp;
    amp *= 0.5; freq *= 2;
  }
  return total / max;
}

export function blockIndex(x: number, y: number, z: number): number {
  return (y * WORLD_D + z) * WORLD_W + x;
}

export function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H && z >= 0 && z < WORLD_D;
}

export function getBlock(world: Uint8Array, x: number, y: number, z: number): number {
  if (!inBounds(x, y, z)) return 0;
  return world[blockIndex(x, y, z)];
}

export function setBlockRaw(world: Uint8Array, x: number, y: number, z: number, id: number): void {
  if (!inBounds(x, y, z)) return;
  world[blockIndex(x, y, z)] = id;
}

export function generateWorld(world: Uint8Array): void {
  const SEED = 7;
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const baseN = fbm(x * 0.045, z * 0.045, SEED);
      const detail = fbm(x * 0.12, z * 0.12, SEED + 99) * 0.3;
      const height = Math.floor(8 + baseN * 16 + detail * 4);
      const isMountain = baseN > 0.72;
      const isBeach = height <= SEA_LEVEL + 1;

      for (let y = 0; y <= height; y++) {
        let id: number;
        if (y === 0) id = 3;
        else if (y < height - 4) id = 3;
        else if (y < height) id = 2;
        else if (isBeach) id = 5;
        else if (isMountain && height > 22) id = 12;
        else id = 1;
        setBlockRaw(world, x, y, z, id);
      }
    }
  }

  // Trees
  const treeRng = rng(101);
  let placed = 0;
  for (let attempt = 0; attempt < 400 && placed < 60; attempt++) {
    const tx = ((treeRng() * (WORLD_W - 4)) | 0) + 2;
    const tz = ((treeRng() * (WORLD_D - 4)) | 0) + 2;
    let sy = 0;
    for (let y = WORLD_H - 1; y > 0; y--) {
      if (getBlock(world, tx, y, tz) !== 0) { sy = y; break; }
    }
    if (getBlock(world, tx, sy, tz) !== 1) continue;
    if (sy > 24) continue;
    let clear = true;
    for (let h = 1; h <= 6; h++) if (getBlock(world, tx, sy + h, tz) !== 0) clear = false;
    if (!clear) continue;
    const treeHeight = 4 + ((treeRng() * 2) | 0);
    for (let h = 1; h <= treeHeight; h++) setBlockRaw(world, tx, sy + h, tz, 6);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = treeHeight - 1; dy <= treeHeight + 2; dy++) {
          const dist = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - treeHeight);
          if (dist > 3) continue;
          if (dx === 0 && dz === 0 && dy <= treeHeight) continue;
          if (treeRng() < 0.85 && getBlock(world, tx + dx, sy + dy, tz + dz) === 0) {
            setBlockRaw(world, tx + dx, sy + dy, tz + dz, 8);
          }
        }
      }
    }
    placed++;
  }

  // Stone outcrops
  for (let i = 0; i < 12; i++) {
    const ox = (Math.random() * WORLD_W) | 0;
    const oz = (Math.random() * WORLD_D) | 0;
    let oy = 0;
    for (let y = WORLD_H - 1; y > 0; y--) if (getBlock(world, ox, y, oz) !== 0) { oy = y; break; }
    if (oy < 14) continue;
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = 1; dy <= 2; dy++)
          if (Math.random() > 0.3 && getBlock(world, ox + dx, oy + dy, oz + dz) === 0)
            setBlockRaw(world, ox + dx, oy + dy, oz + dz, 3);
  }

  // Fill water: any air block at or below sea level becomes water (ID 17)
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 1; y <= SEA_LEVEL; y++) {
        if (getBlock(world, x, y, z) === 0) {
          setBlockRaw(world, x, y, z, 17);
        }
      }
    }
  }
}
