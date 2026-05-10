export interface BlockDef {
  name: string;
  tex: { all?: number; top?: number; side?: number; bottom?: number };
  transparent?: boolean;
  emitLight?: number;  // 0-15 block-light emission
  sprite?: boolean;    // rendered as a 3D entity, not a cube face
  liquid?: boolean;    // fluid — no collision, swim physics
}

export const BLOCKS: Record<number, BlockDef> = {
  1:  { name: 'Grass',             tex: { top: 0,  side: 1,  bottom: 2 } },
  2:  { name: 'Dirt',              tex: { all: 2 } },
  3:  { name: 'Stone',             tex: { all: 3 } },
  4:  { name: 'Cobblestone',       tex: { all: 12 } },
  5:  { name: 'Sand',              tex: { all: 4 } },
  6:  { name: 'Oak Log',           tex: { top: 5,  side: 6,  bottom: 5 } },
  7:  { name: 'Oak Planks',        tex: { all: 8 } },
  8:  { name: 'Leaves',            tex: { all: 7 }, transparent: true },
  9:  { name: 'Bricks',            tex: { all: 9 } },
  10: { name: 'Glass',             tex: { all: 10 }, transparent: true },
  11: { name: 'Stone Bricks',      tex: { all: 11 } },
  12: { name: 'Snow',              tex: { all: 13 } },
  13: { name: 'Gravel',            tex: { all: 14 } },
  14: { name: 'Obsidian',          tex: { all: 15 } },
  15: { name: 'Torch',             tex: { all: 16 }, emitLight: 14, sprite: true },
  16: { name: 'Glowstone',         tex: { all: 17 }, emitLight: 15 },
  17: { name: 'Water',             tex: { all: 18 }, transparent: true, liquid: true },
  18: { name: 'Sandstone',         tex: { top: 20, side: 19, bottom: 20 } },
  19: { name: 'Iron Block',        tex: { all: 21 } },
  20: { name: 'Gold Block',        tex: { all: 22 } },
  21: { name: 'Diamond Block',     tex: { all: 23 } },
  22: { name: 'Red Wool',          tex: { all: 24 } },
  23: { name: 'White Wool',        tex: { all: 25 } },
  24: { name: 'Mossy Cobblestone', tex: { all: 26 } },
  25: { name: 'Bookshelf',         tex: { top: 8,  side: 27, bottom: 8 } },
  26: { name: 'Netherrack',        tex: { all: 28 } },
  27: { name: 'Sponge',            tex: { all: 29 } },
};

export const DEFAULT_HOTBAR = [1, 3, 5, 7, 9, 10, 15, 18, 21];
export const HOTBAR = DEFAULT_HOTBAR;
