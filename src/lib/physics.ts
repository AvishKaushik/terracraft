import { PLAYER_WIDTH, PLAYER_HEIGHT, EYE_HEIGHT } from './constants';
import { getBlock } from './terrain';
import { BLOCKS } from './blocks';

export function isInWater(x: number, y: number, z: number, world: Uint8Array): boolean {
  const r = PLAYER_WIDTH / 2;
  const minX = Math.floor(x - r), maxX = Math.floor(x + r);
  const minZ = Math.floor(z - r), maxZ = Math.floor(z + r);
  // Check the block at the player's waist (~0.4 above feet) within the horizontal footprint
  const by = Math.floor(y + 0.4);
  for (let bx = minX; bx <= maxX; bx++)
    for (let bz = minZ; bz <= maxZ; bz++)
      if (BLOCKS[getBlock(world, bx, by, bz)]?.liquid) return true;
  return false;
}

export function isEyeInWater(x: number, y: number, z: number, world: Uint8Array): boolean {
  return BLOCKS[getBlock(world, Math.floor(x), Math.floor(y + EYE_HEIGHT), Math.floor(z))]?.liquid === true;
}

export function collidesAt(x: number, y: number, z: number, world: Uint8Array): boolean {
  const r = PLAYER_WIDTH / 2;
  const minX = Math.floor(x - r);
  const maxX = Math.floor(x + r);
  const minY = Math.floor(y);
  const maxY = Math.floor(y + PLAYER_HEIGHT - 0.001);
  const minZ = Math.floor(z - r);
  const maxZ = Math.floor(z + r);
  for (let bx = minX; bx <= maxX; bx++)
    for (let by = minY; by <= maxY; by++)
      for (let bz = minZ; bz <= maxZ; bz++) {
        const id = getBlock(world, bx, by, bz);
        // Sprites and liquids are non-solid — player passes through them
        if (id !== 0 && !BLOCKS[id]?.sprite && !BLOCKS[id]?.liquid) return true;
      }
  return false;
}
