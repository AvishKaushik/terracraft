import { create } from 'zustand';
import { WORLD_W, WORLD_H, WORLD_D, CHUNK_SIZE, CHUNKS_X, CHUNKS_Z } from '../lib/constants';
import { BLOCKS } from '../lib/blocks';
import { generateWorld, inBounds, blockIndex } from '../lib/terrain';
import { computeLightMap, computeLightMapLocal } from '../lib/lighting';
import { socket } from '../lib/socket';

const world         = new Uint8Array(WORLD_W * WORLD_H * WORLD_D);
const lightMap      = new Uint8Array(WORLD_W * WORLD_H * WORLD_D);
const skyLightMap   = new Uint8Array(WORLD_W * WORLD_H * WORLD_D);
const blockLightMap = new Uint8Array(WORLD_W * WORLD_H * WORLD_D);
generateWorld(world);
computeLightMap(world, lightMap, skyLightMap, blockLightMap);

export interface TorchEntry {
  x: number;
  y: number;
  z: number;
  face: [number, number, number]; // placement surface normal
}

export interface GlowEntry { x: number; y: number; z: number; }

export interface BlockChange {
  x: number; y: number; z: number; id: number; face?: [number, number, number];
}

interface WorldStore {
  world: Uint8Array;
  lightMap: Uint8Array;
  skyLightMap: Uint8Array;
  blockLightMap: Uint8Array;
  /** Explicit React state — triggers re-renders on any torch add/remove */
  torches: TorchEntry[];
  /** Non-sprite light-emitting blocks (e.g. Glowstone) */
  glowstones: GlowEntry[];
  dirtyChunks: Set<string>;
  setBlock: (x: number, y: number, z: number, id: number, face?: [number, number, number]) => void;
  setBlockSilent: (x: number, y: number, z: number, id: number, face?: [number, number, number]) => void;
  /** Apply many changes at once — single light recompute at the end. */
  applyWorldChanges: (changes: BlockChange[]) => void;
  /** Apply an explosion — uses local lighting and only dirties affected chunks. */
  applyExplosion: (changes: BlockChange[], cx: number, cy: number, cz: number) => void;
  clearDirty: (cx: number, cz: number) => void;
}

function chunkKey(cx: number, cz: number) { return `${cx},${cz}`; }

function markDirtyAt(dirty: Set<string>, x: number, z: number) {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  if (cx >= 0 && cx < CHUNKS_X && cz >= 0 && cz < CHUNKS_Z) dirty.add(chunkKey(cx, cz));
  const lx = x - cx * CHUNK_SIZE, lz = z - cz * CHUNK_SIZE;
  if (lx === 0 && cx > 0)                  dirty.add(chunkKey(cx - 1, cz));
  if (lx === CHUNK_SIZE - 1 && cx < CHUNKS_X - 1) dirty.add(chunkKey(cx + 1, cz));
  if (lz === 0 && cz > 0)                  dirty.add(chunkKey(cx, cz - 1));
  if (lz === CHUNK_SIZE - 1 && cz < CHUNKS_Z - 1) dirty.add(chunkKey(cx, cz + 1));
}

function markAllDirty(dirty: Set<string>) {
  for (let cx = 0; cx < CHUNKS_X; cx++)
    for (let cz = 0; cz < CHUNKS_Z; cz++)
      dirty.add(chunkKey(cx, cz));
}

// Neighbours that might hold a torch supported by the block at (x,y,z)
const TORCH_SUPPORT: Array<{ dx: number; dy: number; dz: number; face: [number,number,number] }> = [
  { dx: 0, dy: 1, dz:  0, face: [0,  1,  0] },
  { dx: 1, dy: 0, dz:  0, face: [1,  0,  0] },
  { dx:-1, dy: 0, dz:  0, face: [-1, 0,  0] },
  { dx: 0, dy: 0, dz:  1, face: [0,  0,  1] },
  { dx: 0, dy: 0, dz: -1, face: [0,  0, -1] },
];

/** Rebuild the torch list by scanning the world (called after any change). */
function scanTorches(): TorchEntry[] {
  const list: TorchEntry[] = [];
  for (let y = 0; y < WORLD_H; y++)
    for (let z = 0; z < WORLD_D; z++)
      for (let x = 0; x < WORLD_W; x++)
        if (world[(y * WORLD_D + z) * WORLD_W + x] === 15)
          list.push({ x, y, z, face: [0, 1, 0] }); // face resolved below
  return list;
}

// Separate orientation map (not React state — read-only at render time)
const torchFaces = new Map<number, [number, number, number]>();

function buildTorchList(): TorchEntry[] {
  const list: TorchEntry[] = [];
  for (let y = 0; y < WORLD_H; y++)
    for (let z = 0; z < WORLD_D; z++)
      for (let x = 0; x < WORLD_W; x++)
        if (world[(y * WORLD_D + z) * WORLD_W + x] === 15) {
          const idx = blockIndex(x, y, z);
          list.push({ x, y, z, face: torchFaces.get(idx) ?? [0, 1, 0] });
        }
  return list;
}

void scanTorches; // unused — kept for reference

function buildGlowstoneList(): GlowEntry[] {
  const list: GlowEntry[] = [];
  for (let y = 0; y < WORLD_H; y++)
    for (let z = 0; z < WORLD_D; z++)
      for (let x = 0; x < WORLD_W; x++)
        if (world[(y * WORLD_D + z) * WORLD_W + x] === 16)
          list.push({ x, y, z });
  return list;
}

export const useWorldStore = create<WorldStore>((set) => ({
  world,
  lightMap,
  skyLightMap,
  blockLightMap,
  torches: [],
  glowstones: buildGlowstoneList(),
  dirtyChunks: new Set<string>(),

  setBlock(x, y, z, id, face) {
    if (!inBounds(x, y, z)) return;
    const idx   = blockIndex(x, y, z);
    const oldId = world[idx];

    world[idx] = id;

    // Maintain orientation map
    if (id === 15 && face) torchFaces.set(idx, face);
    else                   torchFaces.delete(idx);

    socket.emit('block:set', {
      x, y, z, id,
      face: id === 15 && face ? face : undefined,
    });

    const isLightChange =
      (BLOCKS[id]?.emitLight ?? 0) > 0 || (BLOCKS[oldId]?.emitLight ?? 0) > 0;

    // Incremental recompute — only touches cells within 15 blocks of the change
    computeLightMapLocal(world, lightMap, skyLightMap, blockLightMap, x, y, z);

    set(state => {
      const dirty = new Set(state.dirtyChunks);
      if (isLightChange) markAllDirty(dirty); else markDirtyAt(dirty, x, z);

      // Break torches whose supporting block was just removed
      let needRescan = id === 15 || oldId === 15;
      if (id === 0 && oldId !== 0) {
        for (const { dx, dy, dz, face: sf } of TORCH_SUPPORT) {
          const tx = x + dx, ty = y + dy, tz = z + dz;
          if (!inBounds(tx, ty, tz)) continue;
          const tidx = blockIndex(tx, ty, tz);
          if (world[tidx] !== 15) continue;
          const stored = torchFaces.get(tidx);
          if (stored && stored[0] === sf[0] && stored[1] === sf[1] && stored[2] === sf[2]) {
            world[tidx] = 0;
            torchFaces.delete(tidx);
            markDirtyAt(dirty, tx, tz);
            needRescan = true;
          }
        }
        if (needRescan) computeLightMapLocal(world, lightMap, skyLightMap, blockLightMap, x, y, z);
      }

      const needGlowRescan = id === 16 || oldId === 16;
      return {
        dirtyChunks: dirty,
        torches:     needRescan      ? buildTorchList()     : state.torches,
        glowstones:  needGlowRescan  ? buildGlowstoneList() : state.glowstones,
      };
    });
  },

  setBlockSilent(x, y, z, id, face) {
    if (!inBounds(x, y, z)) return;
    const idx   = blockIndex(x, y, z);
    const oldId = world[idx];

    world[idx] = id;

    if (id === 15 && face) torchFaces.set(idx, face);
    else                   torchFaces.delete(idx);

    computeLightMap(world, lightMap, skyLightMap, blockLightMap);

    const isLightChange =
      (BLOCKS[id]?.emitLight ?? 0) > 0 || (BLOCKS[oldId]?.emitLight ?? 0) > 0;

    set(state => {
      const dirty = new Set(state.dirtyChunks);
      if (isLightChange) markAllDirty(dirty); else markDirtyAt(dirty, x, z);

      const needRescan = id === 15 || (id === 0 && oldId === 15);
      if (id === 0 && oldId !== 0) {
        for (const { dx, dy, dz, face: sf } of TORCH_SUPPORT) {
          const tx = x + dx, ty = y + dy, tz = z + dz;
          if (!inBounds(tx, ty, tz)) continue;
          const tidx = blockIndex(tx, ty, tz);
          if (world[tidx] !== 15) continue;
          const stored = torchFaces.get(tidx);
          if (stored && stored[0] === sf[0] && stored[1] === sf[1] && stored[2] === sf[2]) {
            world[tidx] = 0;
            torchFaces.delete(tidx);
          }
        }
        computeLightMap(world, lightMap, skyLightMap, blockLightMap);
      }

      const needGlowRescan = id === 16 || oldId === 16;
      return {
        dirtyChunks: dirty,
        torches:     needRescan      ? buildTorchList()     : state.torches,
        glowstones:  needGlowRescan  ? buildGlowstoneList() : state.glowstones,
      };
    });
  },

  applyWorldChanges(changes) {
    if (changes.length === 0) return;

    for (const { x, y, z, id, face } of changes) {
      if (!inBounds(x, y, z)) continue;
      const idx = blockIndex(x, y, z);
      world[idx] = id;
      if (id === 15 && face) torchFaces.set(idx, face);
      else                   torchFaces.delete(idx);
    }

    // Single light recompute for the entire batch
    computeLightMap(world, lightMap, skyLightMap, blockLightMap);

    const allDirty = new Set<string>();
    markAllDirty(allDirty);

    set({
      dirtyChunks: allDirty,
      torches:    buildTorchList(),
      glowstones: buildGlowstoneList(),
    });
  },

  applyExplosion(changes, cx, cy, cz) {
    if (changes.length === 0) return;
    let hadTorch = false;
    for (const { x, y, z, id } of changes) {
      if (!inBounds(x, y, z)) continue;
      const idx = blockIndex(x, y, z);
      if (world[idx] === 15) hadTorch = true;
      world[idx] = id;
      torchFaces.delete(idx);
    }
    computeLightMapLocal(world, lightMap, skyLightMap, blockLightMap, cx, cy, cz);
    const dirty = new Set<string>();
    for (const { x, z } of changes) markDirtyAt(dirty, x, z);
    set(state => ({
      dirtyChunks: dirty,
      torches:    hadTorch ? buildTorchList() : state.torches,
      glowstones: state.glowstones,
    }));
  },

  clearDirty(cx, cz) {
    set(state => {
      const dirty = new Set(state.dirtyChunks);
      dirty.delete(chunkKey(cx, cz));
      return { dirtyChunks: dirty };
    });
  },
}));
