export interface BlockDef {
  name: string;
  tex: { all?: number; top?: number; side?: number; bottom?: number };
  transparent?: boolean;
  emitLight?: number;
  sprite?: boolean;
  liquid?: boolean;
  hardness: number; // seconds to break bare-handed; 0 = instant, 999 = unbreakable
}

export const BLOCKS: Record<number, BlockDef> = {
  1:  { name: 'Grass',             tex: { top: 0,  side: 1,  bottom: 2 }, hardness: 0.6  },
  2:  { name: 'Dirt',              tex: { all: 2  },                       hardness: 0.5  },
  3:  { name: 'Stone',             tex: { all: 3  },                       hardness: 1.5  },
  4:  { name: 'Cobblestone',       tex: { all: 12 },                       hardness: 2.0  },
  5:  { name: 'Sand',              tex: { all: 4  },                       hardness: 0.5  },
  6:  { name: 'Oak Log',           tex: { top: 5,  side: 6,  bottom: 5 }, hardness: 2.0  },
  7:  { name: 'Oak Planks',        tex: { all: 8  },                       hardness: 1.5  },
  8:  { name: 'Leaves',            tex: { all: 7  }, transparent: true,    hardness: 0.2  },
  9:  { name: 'Bricks',            tex: { all: 9  },                       hardness: 3.0  },
  10: { name: 'Glass',             tex: { all: 10 }, transparent: true,    hardness: 0.3  },
  11: { name: 'Stone Bricks',      tex: { all: 11 },                       hardness: 3.0  },
  12: { name: 'Snow',              tex: { all: 13 },                       hardness: 0.1  },
  13: { name: 'Gravel',            tex: { all: 14 },                       hardness: 0.6  },
  14: { name: 'Obsidian',          tex: { all: 15 },                       hardness: 8.0  },
  15: { name: 'Torch',             tex: { all: 16 }, emitLight: 14, sprite: true, hardness: 0 },
  16: { name: 'Glowstone',         tex: { all: 17 }, emitLight: 15,        hardness: 0.3  },
  17: { name: 'Water',             tex: { all: 18 }, transparent: true, liquid: true, hardness: 999 },
  18: { name: 'Sandstone',         tex: { top: 20, side: 19, bottom: 20 }, hardness: 0.8  },
  19: { name: 'Iron Block',        tex: { all: 21 },                       hardness: 5.0  },
  20: { name: 'Gold Block',        tex: { all: 22 },                       hardness: 3.0  },
  21: { name: 'Diamond Block',     tex: { all: 23 },                       hardness: 5.0  },
  22: { name: 'Red Wool',          tex: { all: 24 },                       hardness: 0.8  },
  23: { name: 'White Wool',        tex: { all: 25 },                       hardness: 0.8  },
  24: { name: 'Mossy Cobblestone', tex: { all: 26 },                       hardness: 2.0  },
  25: { name: 'Bookshelf',         tex: { top: 8,  side: 27, bottom: 8 }, hardness: 1.5  },
  26: { name: 'Netherrack',        tex: { all: 28 },                       hardness: 0.4  },
  27: { name: 'Sponge',            tex: { all: 29 },                       hardness: 0.6  },
  28: { name: 'Coal Ore',          tex: { all: 30 },                       hardness: 1.5  },
  29: { name: 'Iron Ore',          tex: { all: 31 },                       hardness: 2.0  },
  30: { name: 'Gold Ore',          tex: { all: 32 },                       hardness: 2.0  },
  31: { name: 'Diamond Ore',       tex: { all: 33 },                       hardness: 3.0  },
  32: { name: 'Chest',             tex: { top: 34, side: 35, bottom: 34 }, hardness: 2.5  },
};

export const DEFAULT_HOTBAR = [1, 3, 5, 7, 9, 10, 15, 18, 21];
export const HOTBAR = DEFAULT_HOTBAR;
