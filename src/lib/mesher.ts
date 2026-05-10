import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_W, WORLD_H, WORLD_D, ATLAS_COLS, ATLAS_ROWS } from './constants';
import { BLOCKS } from './blocks';
import { getBlock, blockIndex } from './terrain';

interface FaceDef {
  dir: [number, number, number];
  verts: [number, number, number][];
  tint: number;
  kind: 'top' | 'bottom' | 'side';
}

const FACES: FaceDef[] = [
  { dir: [1, 0, 0],  verts: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], tint: 0.70, kind: 'side' },
  { dir: [-1, 0, 0], verts: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], tint: 0.70, kind: 'side' },
  { dir: [0, 1, 0],  verts: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], tint: 1.00, kind: 'top' },
  { dir: [0, -1, 0], verts: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], tint: 0.35, kind: 'bottom' },
  { dir: [0, 0, 1],  verts: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], tint: 0.82, kind: 'side' },
  { dir: [0, 0, -1], verts: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], tint: 0.82, kind: 'side' },
];

const AO_CURVE = [0.0, 0.35, 0.65, 1.0];
const MIN_LIGHT = 0.03;

function isSolid(world: Uint8Array, x: number, y: number, z: number): boolean {
  const id = getBlock(world, x, y, z);
  if (id === 0) return false;
  const def = BLOCKS[id];
  return !def?.transparent && !def?.sprite;
}

function aoValue(s1: boolean, s2: boolean, corner: boolean): number {
  if (s1 && s2) return 0;
  return 3 - (s1 ? 1 : 0) - (s2 ? 1 : 0) - (corner ? 1 : 0);
}

function vertAO(world: Uint8Array, bx: number, by: number, bz: number, face: FaceDef, vi: number): number {
  const v  = face.verts[vi];
  const [nx, ny, nz] = face.dir;
  const fx = bx + nx, fy = by + ny, fz = bz + nz;

  if (ny !== 0) {
    const dx = v[0] ? 1 : -1, dz = v[2] ? 1 : -1;
    return aoValue(isSolid(world, fx+dx, fy, fz), isSolid(world, fx, fy, fz+dz), isSolid(world, fx+dx, fy, fz+dz));
  } else if (nx !== 0) {
    const dy = v[1] ? 1 : -1, dz = v[2] ? 1 : -1;
    return aoValue(isSolid(world, fx, fy+dy, fz), isSolid(world, fx, fy, fz+dz), isSolid(world, fx, fy+dy, fz+dz));
  } else {
    const dx = v[0] ? 1 : -1, dy = v[1] ? 1 : -1;
    return aoValue(isSolid(world, fx+dx, fy, fz), isSolid(world, fx, fy+dy, fz), isSolid(world, fx+dx, fy+dy, fz));
  }
}

function texIndexFor(blockId: number, kind: 'top' | 'bottom' | 'side'): number {
  const t = BLOCKS[blockId].tex;
  if (t.all !== undefined) return t.all;
  if (kind === 'top') return t.top!;
  if (kind === 'bottom') return t.bottom!;
  return t.side!;
}

interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  skyLights: number[];
  indices: number[];
  vi: number;
}

function makeMeshData(): MeshData {
  return { positions: [], normals: [], uvs: [], colors: [], skyLights: [], indices: [], vi: 0 };
}

function dataToGeometry(data: MeshData): THREE.BufferGeometry | null {
  if (data.positions.length === 0) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position',  new THREE.Float32BufferAttribute(data.positions, 3));
  geom.setAttribute('normal',    new THREE.Float32BufferAttribute(data.normals, 3));
  geom.setAttribute('uv',        new THREE.Float32BufferAttribute(data.uvs, 2));
  geom.setAttribute('color',     new THREE.Float32BufferAttribute(data.colors, 3));
  geom.setAttribute('aSkyLight', new THREE.Float32BufferAttribute(data.skyLights, 1));
  geom.setIndex(data.indices);
  return geom;
}

export function buildChunkGeometry(
  cx: number,
  cz: number,
  world: Uint8Array,
  _lightMap: Uint8Array,
  skyLightMap: Uint8Array,
  blockLightMap: Uint8Array,
): { opaque: THREE.BufferGeometry | null; trans: THREE.BufferGeometry | null } {
  const opaque = makeMeshData();
  const trans  = makeMeshData();

  const startX = cx * CHUNK_SIZE;
  const startZ = cz * CHUNK_SIZE;
  const endX = Math.min(startX + CHUNK_SIZE, WORLD_W);
  const endZ = Math.min(startZ + CHUNK_SIZE, WORLD_D);

  const sw = 1 / ATLAS_COLS;
  const sh = 1 / ATLAS_ROWS;
  const eps = 0.0008;

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      for (let y = 0; y < WORLD_H; y++) {
        const id = getBlock(world, x, y, z);
        if (id === 0) continue;
        const block = BLOCKS[id];
        if (block.sprite) continue; // rendered separately as a 3D entity
        const isTrans = !!block.transparent;
        const target = isTrans ? trans : opaque;

        for (const face of FACES) {
          const [dx, dy, dz] = face.dir;
          const nid = getBlock(world, x + dx, y + dy, z + dz);
          const nDef = BLOCKS[nid];
          let render = false;
          if (nid === 0 || nDef?.sprite) render = true;
          else if (nDef?.transparent && nid !== id) render = true;
          if (!render) continue;

          const texIdx = texIndexFor(id, face.kind);
          const tCol = texIdx % ATLAS_COLS;
          const tRow = Math.floor(texIdx / ATLAS_COLS);
          const u0 = tCol * sw + eps, u1 = (tCol + 1) * sw - eps;
          const v0 = 1 - (tRow + 1) * sh + eps, v1 = 1 - tRow * sh - eps;
          const faceUVs = [u0, v0, u1, v0, u1, v1, u0, v1];

          const ao = isTrans
            ? [3, 3, 3, 3]
            : [vertAO(world, x, y, z, face, 0), vertAO(world, x, y, z, face, 1),
               vertAO(world, x, y, z, face, 2), vertAO(world, x, y, z, face, 3)];

          // Separate sky and block light from the neighboring cell this face is exposed to
          const lx = x + dx, ly = y + dy, lz = z + dz;
          let blockFaceLight: number;
          let skyFaceLight: number;
          if (lx < 0 || lx >= WORLD_W || ly < 0 || ly >= WORLD_H || lz < 0 || lz >= WORLD_D) {
            blockFaceLight = 0;
            skyFaceLight = 15; // outside world bounds = open sky
          } else {
            const li = blockIndex(lx, ly, lz);
            blockFaceLight = blockLightMap[li];
            skyFaceLight = skyLightMap[li];
          }
          const selfEmit = block.emitLight ?? 0;
          const effectiveBlock = Math.max(selfEmit, blockFaceLight);
          const blockBright = Math.max(MIN_LIGHT, effectiveBlock / 15);
          const skyBright = skyFaceLight / 15;

          for (let i = 0; i < 4; i++) {
            const v = face.verts[i];
            const aoF = face.tint * AO_CURVE[ao[i]];
            target.positions.push(x + v[0], y + v[1], z + v[2]);
            target.normals.push(dx, dy, dz);
            target.uvs.push(faceUVs[i * 2], faceUVs[i * 2 + 1]);
            const b = aoF * blockBright;
            target.colors.push(b, b, b);
            target.skyLights.push(aoF * skyBright);
          }

          const flip = ao[0] + ao[2] < ao[1] + ao[3];
          const vi = target.vi;
          if (flip) {
            target.indices.push(vi+1, vi+2, vi+3, vi, vi+1, vi+3);
          } else {
            target.indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
          }
          target.vi += 4;
        }
      }
    }
  }

  return { opaque: dataToGeometry(opaque), trans: dataToGeometry(trans) };
}
