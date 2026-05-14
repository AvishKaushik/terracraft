import type { MobType } from '../stores/mobStore';

export function getMobDrop(type: MobType): { id: number; count: number } | null {
  if (type === 'cow')      return { id: 266, count: 1 + Math.floor(Math.random() * 2) };
  if (type === 'zombie')   return { id: 268, count: 1 };
  if (type === 'skeleton') return { id: 281, count: 1 + Math.floor(Math.random() * 2) }; // arrows
  if (type === 'spider')   return { id: 278, count: 1 + Math.floor(Math.random() * 2) }; // string
  if (type === 'slime')    return { id: 285, count: 1 + Math.floor(Math.random() * 2) }; // slimeball
  return null;
}

// Blocks that break faster with a pickaxe
export const PICKAXE_BLOCKS = new Set([3, 4, 9, 11, 14, 19, 20, 21, 24, 28, 29, 30, 31, 32]);

// Drop overrides: undefined means drop the block itself; null means drop nothing
const DROP_OVERRIDES: Record<number, { id: number; count: number } | null> = {
  1:  { id: 2,  count: 1 },  // Grass → Dirt
  3:  { id: 4,  count: 1 },  // Stone → Cobblestone
  8:  null,                   // Leaves → nothing
  17: null,                   // Water → nothing
  36: null,                   // Dead Bush → nothing
  37: null,                   // Poppy → nothing
  38: null,                   // Lava → nothing
  40: { id: 2,  count: 1 },  // Farmland → Dirt
  41: { id: 283, count: 1 }, // Wheat seedling → seeds
  42: { id: 284, count: 1 }, // Wheat ripe → wheat (seeds also via special handling)
  43: null,                   // Enchanting Table → nothing (too expensive to keep)
  44: null,                   // Brewing Stand → nothing
  45: null,                   // Spawner → nothing
};

export function getBlockDrop(blockId: number): { id: number; count: number } | null {
  if (blockId in DROP_OVERRIDES) return DROP_OVERRIDES[blockId];
  return { id: blockId, count: 1 };
}
