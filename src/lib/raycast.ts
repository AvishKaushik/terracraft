import * as THREE from 'three';
import { REACH, EYE_HEIGHT } from './constants';
import { getBlock, inBounds } from './terrain';

export interface RaycastHit {
  x: number; y: number; z: number;
  face: [number, number, number];
}

export function raycastBlock(
  pos: THREE.Vector3,
  yaw: number,
  pitch: number,
  world: Uint8Array
): RaycastHit | null {
  const ox = pos.x;
  const oy = pos.y + EYE_HEIGHT;
  const oz = pos.z;

  const cosP = Math.cos(pitch);
  const dx = -Math.sin(yaw) * cosP;
  const dy =  Math.sin(pitch);
  const dz = -Math.cos(yaw) * cosP;

  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dx);
  const tDeltaY = Math.abs(1 / dy);
  const tDeltaZ = Math.abs(1 / dz);
  let tMaxX = tDeltaX * (dx > 0 ? (x + 1 - ox) : (ox - x));
  let tMaxY = tDeltaY * (dy > 0 ? (y + 1 - oy) : (oy - y));
  let tMaxZ = tDeltaZ * (dz > 0 ? (z + 1 - oz) : (oz - z));

  let face: [number, number, number] = [0, 0, 0];
  let dist = 0;

  while (dist < REACH) {
    if (inBounds(x, y, z) && getBlock(world, x, y, z) !== 0) {
      return { x, y, z, face };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; dist = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY; dist = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0];
    } else {
      z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ];
    }
  }
  return null;
}
