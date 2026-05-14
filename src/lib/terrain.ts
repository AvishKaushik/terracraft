import { WORLD_W, WORLD_H, WORLD_D, SEA_LEVEL } from './constants';

// ── Noise primitives ────────────────────────────────────────────────────

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

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = (x * 374761393 + y * 1274126177 + z * 668265263 + seed * 982451653) | 0;
  h = ((h ^ (h >>> 13)) * 1664525)    | 0;
  h = ((h ^ (h >>> 16)) * 2246822519) | 0;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967295;
}

function smoothstep(t: number): number { return t * t * (3 - 2 * t); }

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix,     iz,     seed);
  const b = hash2(ix + 1, iz,     seed);
  const c = hash2(ix,     iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smoothstep(fx), v = smoothstep(fz);
  return a*(1-u)*(1-v) + b*u*(1-v) + c*(1-u)*v + d*u*v;
}

function valueNoise3D(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = smoothstep(fx), v = smoothstep(fy), w = smoothstep(fz);
  const c000 = hash3(ix,     iy,     iz,     seed);
  const c100 = hash3(ix + 1, iy,     iz,     seed);
  const c010 = hash3(ix,     iy + 1, iz,     seed);
  const c110 = hash3(ix + 1, iy + 1, iz,     seed);
  const c001 = hash3(ix,     iy,     iz + 1, seed);
  const c101 = hash3(ix + 1, iy,     iz + 1, seed);
  const c011 = hash3(ix,     iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);
  return (
    c000*(1-u)*(1-v)*(1-w) + c100*u*(1-v)*(1-w) +
    c010*(1-u)*v*(1-w)     + c110*u*v*(1-w) +
    c001*(1-u)*(1-v)*w     + c101*u*(1-v)*w +
    c011*(1-u)*v*w         + c111*u*v*w
  );
}

function fbm(x: number, z: number, seed: number): number {
  let total = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < 4; i++) {
    total += valueNoise(x * freq, z * freq, seed + i * 17) * amp;
    max += amp; amp *= 0.5; freq *= 2;
  }
  return total / max;
}

// ── World helpers ───────────────────────────────────────────────────────

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

// ── Biome detection ─────────────────────────────────────────────────────

const SEED = 7;

export type Biome = 'desert' | 'tundra' | 'forest' | 'plains';

export function getBiome(x: number, z: number): Biome {
  const temp     = fbm(x * 0.018, z * 0.018, SEED + 200);
  const moisture = fbm(x * 0.018, z * 0.018, SEED + 400);
  if (temp > 0.62) return 'desert';
  if (temp < 0.38) return 'tundra';
  if (moisture > 0.55) return 'forest';
  return 'plains';
}

// ── Village locations ──────────────────────────────────────────────────

export const VILLAGE_SEEDS = [
  { vx: 24,  vz: 24  },
  { vx: 80,  vz: 20  },
  { vx: 160, vz: 30  },
  { vx: 220, vz: 55  },
  { vx: 28,  vz: 120 },
  { vx: 128, vz: 105 },
  { vx: 210, vz: 125 },
  { vx: 50,  vz: 195 },
  { vx: 140, vz: 200 },
  { vx: 220, vz: 220 },
] as const;

// ── World generation ────────────────────────────────────────────────────

export function generateWorld(world: Uint8Array): void {
  const surfaceY = new Int32Array(WORLD_W * WORLD_D);

  // Pass 1 — terrain shape + surface blocks
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const baseN  = fbm(x * 0.045, z * 0.045, SEED);
      const detail = fbm(x * 0.12,  z * 0.12,  SEED + 99) * 0.3;
      const height = Math.floor(8 + baseN * 16 + detail * 4);
      const biome  = getBiome(x, z);
      const isMountain = baseN > 0.72;
      const isBeach    = height <= SEA_LEVEL + 1;

      surfaceY[z * WORLD_W + x] = height;

      for (let y = 0; y <= height; y++) {
        let id: number;
        if (y < height - 4) {
          id = 3; // stone
        } else if (y < height) {
          id = biome === 'desert' ? 18 : 2; // sandstone subsurface for desert, else dirt
        } else {
          // surface block
          if (isBeach || biome === 'desert') {
            id = 5; // sand
          } else if (biome === 'tundra' && height > SEA_LEVEL + 1) {
            id = 12; // snow
          } else if (isMountain && height > 22) {
            id = 12; // snow cap
          } else {
            id = 1; // grass
          }
        }
        setBlockRaw(world, x, y, z, id);
      }
    }
  }

  // Pass 2 — cave carving with 3D value noise
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const sy = surfaceY[z * WORLD_W + x];
      for (let y = 2; y < Math.min(sy - 1, 22); y++) {
        if (getBlock(world, x, y, z) === 0) continue;
        const n1 = valueNoise3D(x * 0.18, y * 0.22, z * 0.18, SEED + 300);
        const n2 = valueNoise3D(x * 0.18, y * 0.22, z * 0.18, SEED + 500);
        if (Math.abs(n1 - 0.5) < 0.09 && Math.abs(n2 - 0.5) < 0.10) {
          setBlockRaw(world, x, y, z, 0);
        }
      }
    }
  }

  // Pass 3 — ore placement (depth-stratified, partitioned probability bands)
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 1; y <= 22; y++) {
        if (getBlock(world, x, y, z) !== 3) continue;
        const h = hash3(x, y, z, SEED + 700);
        if (y <= 6  && h < 0.003) { setBlockRaw(world, x, y, z, 31); continue; } // diamond
        if (y <= 10 && h < 0.010) { setBlockRaw(world, x, y, z, 30); continue; } // gold
        if (y <= 16 && h < 0.025) { setBlockRaw(world, x, y, z, 29); continue; } // iron
        if (y <= 22 && h < 0.060) { setBlockRaw(world, x, y, z, 28); }            // coal
      }
    }
  }

  // Pass 4 — trees (biome-aware density + height)
  const treeRng = rng(101);
  let placed = 0;
  for (let attempt = 0; attempt < 8000 && placed < 900; attempt++) {
    const tx = ((treeRng() * (WORLD_W - 4)) | 0) + 2;
    const tz = ((treeRng() * (WORLD_D - 4)) | 0) + 2;
    const biome = getBiome(tx, tz);
    if (biome === 'desert' || biome === 'tundra') continue;

    let sy = 0;
    for (let y = WORLD_H - 1; y > 0; y--) {
      if (getBlock(world, tx, y, tz) !== 0) { sy = y; break; }
    }
    if (getBlock(world, tx, sy, tz) !== 1) continue;
    if (sy > 24) continue;
    let clear = true;
    for (let h = 1; h <= 6; h++) if (getBlock(world, tx, sy + h, tz) !== 0) clear = false;
    if (!clear) continue;

    const treeHeight = 4 + ((treeRng() * (biome === 'forest' ? 3 : 2)) | 0);
    for (let h = 1; h <= treeHeight; h++) setBlockRaw(world, tx, sy + h, tz, 6);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = treeHeight - 1; dy <= treeHeight + 2; dy++) {
          const dist = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - treeHeight);
          if (dist > 3) continue;
          if (dx === 0 && dz === 0 && dy <= treeHeight) continue;
          if (treeRng() < 0.85 && getBlock(world, tx + dx, sy + dy, tz + dz) === 0)
            setBlockRaw(world, tx + dx, sy + dy, tz + dz, 8);
        }
      }
    }
    placed++;
  }

  // Pass 5 — stone outcrops on surface
  for (let i = 0; i < 80; i++) {
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

  // Pass 2.5 — underground lava pools (fill open air at y ≤ 4)
  for (let x = 1; x < WORLD_W - 1; x++) {
    for (let z = 1; z < WORLD_D - 1; z++) {
      for (let y = 2; y <= 4; y++) {
        if (getBlock(world, x, y, z) === 0)
          setBlockRaw(world, x, y, z, 38);
      }
    }
  }

  // Pass 6 — fill sea-level water
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      for (let y = 1; y <= SEA_LEVEL; y++) {
        if (getBlock(world, x, y, z) === 0)
          setBlockRaw(world, x, y, z, 17);
      }
    }
  }

  // Pass 7 — desert surface decoration (cactus + dead bushes)
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const biome = getBiome(x, z);
      if (biome !== 'desert') continue;
      const sy = surfaceY[z * WORLD_W + x];
      if (sy <= SEA_LEVEL || getBlock(world, x, sy, z) !== 5) continue;
      const h = hash2(x, z, SEED + 800);
      if (h < 0.025) {
        // Cactus — 1–3 blocks tall, check no adjacent cactus
        if (getBlock(world, x - 1, sy + 1, z) === 35 || getBlock(world, x + 1, sy + 1, z) === 35 ||
            getBlock(world, x, sy + 1, z - 1) === 35 || getBlock(world, x, sy + 1, z + 1) === 35) continue;
        const height = 1 + ((h * 40) | 0) % 3;
        for (let dy = 1; dy <= height; dy++) setBlockRaw(world, x, sy + dy, z, 35);
      } else if (h < 0.085) {
        setBlockRaw(world, x, sy + 1, z, 36); // dead bush
      }
    }
  }

  // Pass 8 — plains/forest flowers
  for (let x = 0; x < WORLD_W; x++) {
    for (let z = 0; z < WORLD_D; z++) {
      const biome = getBiome(x, z);
      if (biome !== 'plains' && biome !== 'forest') continue;
      const sy = surfaceY[z * WORLD_W + x];
      if (sy <= SEA_LEVEL + 1 || getBlock(world, x, sy, z) !== 1) continue;
      const h = hash2(x, z, SEED + 900);
      if (h < 0.075) setBlockRaw(world, x, sy + 1, z, 37); // poppy
    }
  }

  // Pass 9 — villages (10 cobblestone houses spread across the map)
  for (const { vx, vz } of VILLAGE_SEEDS) {
    if (vx + 8 >= WORLD_W || vz + 8 >= WORLD_D) continue;
    const sy = surfaceY[vz * WORLD_W + vx];
    if (sy <= SEA_LEVEL + 1 || sy > 28) continue;
    const gy = sy + 1;
    // 6×6 footprint cobblestone walls, 4 high
    for (let dx = 0; dx < 7; dx++) {
      for (let dz = 0; dz < 7; dz++) {
        if (dx === 0 || dx === 6 || dz === 0 || dz === 6) {
          for (let dy = 0; dy < 4; dy++) setBlockRaw(world, vx + dx, gy + dy, vz + dz, 4);
        }
      }
    }
    // Oak plank roof
    for (let dx = 0; dx < 7; dx++)
      for (let dz = 0; dz < 7; dz++)
        setBlockRaw(world, vx + dx, gy + 4, vz + dz, 7);
    // Window gaps
    setBlockRaw(world, vx + 1, gy + 2, vz,     0);
    setBlockRaw(world, vx + 5, gy + 2, vz + 6, 0);
    // Door opening
    setBlockRaw(world, vx + 3, gy,     vz, 0);
    setBlockRaw(world, vx + 3, gy + 1, vz, 0);
    // Chest + torches inside
    setBlockRaw(world, vx + 1, gy,     vz + 1, 32);
    setBlockRaw(world, vx + 5, gy + 2, vz + 3, 15);
    setBlockRaw(world, vx + 1, gy + 2, vz + 3, 15);
    // Enchanting table in some villages
    if ((vx + vz) % 3 === 0) setBlockRaw(world, vx + 4, gy, vz + 5, 43);
  }

  // Pass 10 — dungeons (8 underground cobblestone rooms with spawner + chest)
  const dungeonSeeds = [
    { dx: 40,  dz: 35  }, { dx: 100, dz: 60  }, { dx: 180, dz: 45  },
    { dx: 55,  dz: 150 }, { dx: 145, dz: 140 }, { dx: 220, dz: 160 },
    { dx: 80,  dz: 220 }, { dx: 200, dz: 210 },
  ];
  for (const { dx, dz } of dungeonSeeds) {
    if (dx + 6 >= WORLD_W || dz + 6 >= WORLD_D) continue;
    const sy = Math.min(10, surfaceY[dz * WORLD_W + dx] - 2);
    if (sy < 4) continue;
    const gy = Math.max(4, sy - 4);
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6) {
          for (let k = 0; k < 4; k++) setBlockRaw(world, dx + i, gy + k, dz + j, 4);
        }
        setBlockRaw(world, dx + i, gy - 1, dz + j, 4); // floor
        setBlockRaw(world, dx + i, gy + 4, dz + j, 4); // ceiling
      }
    }
    // Hollow interior
    for (let i = 1; i < 6; i++)
      for (let j = 1; j < 6; j++)
        for (let k = 0; k < 4; k++) setBlockRaw(world, dx + i, gy + k, dz + j, 0);
    // Door
    setBlockRaw(world, dx + 3, gy,     dz, 0);
    setBlockRaw(world, dx + 3, gy + 1, dz, 0);
    // Spawner, chest, torches
    setBlockRaw(world, dx + 3, gy, dz + 3, 45);
    setBlockRaw(world, dx + 1, gy, dz + 1, 32);
    setBlockRaw(world, dx + 1, gy + 2, dz,     15);
    setBlockRaw(world, dx + 5, gy + 2, dz + 6, 15);
    setBlockRaw(world, dx + 5, gy + 2, dz,     15);
  }
}

