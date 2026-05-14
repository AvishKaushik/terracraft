import { BLOCKS } from './blocks';

export interface ItemDef {
  name: string;
  speedMult?: number;      // pickaxe break-speed multiplier on stone/ore
  attackDamage?: number;   // extra mob damage
  foodValue?: number;      // hunger restored on eating
  armorValue?: number;     // defense points contributed when equipped
  armorSlot?: 'head' | 'chest' | 'legs' | 'feet';
  potionEffect?: 'healing' | 'speed' | 'strength'; // potion type
  isTool?: boolean;        // hoe / fishing rod etc.
  stackable: boolean;
}

export const ENCHANTS = ['Sharpness', 'Efficiency', 'Protection'] as const;
export type EnchantName = typeof ENCHANTS[number];

export const ITEMS: Record<number, ItemDef> = {
  256: { name: 'Wooden Pickaxe',  speedMult: 2, attackDamage: 1, stackable: false },
  257: { name: 'Stone Pickaxe',   speedMult: 4, attackDamage: 2, stackable: false },
  258: { name: 'Iron Pickaxe',    speedMult: 6, attackDamage: 3, stackable: false },
  259: { name: 'Diamond Pickaxe', speedMult: 8, attackDamage: 4, stackable: false },
  260: { name: 'Wooden Sword',    attackDamage: 2, stackable: false },
  261: { name: 'Stone Sword',     attackDamage: 3, stackable: false },
  262: { name: 'Iron Sword',      attackDamage: 4, stackable: false },
  263: { name: 'Diamond Sword',   attackDamage: 5, stackable: false },
  264: { name: 'Bread',              foodValue: 5, stackable: true },
  265: { name: 'Apple',             foodValue: 4, stackable: true },
  // Mob drops / food
  266: { name: 'Raw Beef',          foodValue: 3, stackable: true },
  267: { name: 'Cooked Beef',       foodValue: 8, stackable: true },
  268: { name: 'Rotten Flesh',      foodValue: 2, stackable: true },
  // Iron armor (defense 2/6/5/2 = 15 total)
  270: { name: 'Iron Helmet',      armorValue: 2, armorSlot: 'head',  stackable: false },
  271: { name: 'Iron Chestplate',  armorValue: 6, armorSlot: 'chest', stackable: false },
  272: { name: 'Iron Leggings',    armorValue: 5, armorSlot: 'legs',  stackable: false },
  273: { name: 'Iron Boots',       armorValue: 2, armorSlot: 'feet',  stackable: false },
  // Diamond armor (defense 3/8/6/3 = 20 total)
  274: { name: 'Diamond Helmet',     armorValue: 3, armorSlot: 'head',  stackable: false },
  275: { name: 'Diamond Chestplate', armorValue: 8, armorSlot: 'chest', stackable: false },
  276: { name: 'Diamond Leggings',   armorValue: 6, armorSlot: 'legs',  stackable: false },
  277: { name: 'Diamond Boots',      armorValue: 3, armorSlot: 'feet',  stackable: false },
  // Combat / crafting components
  278: { name: 'String',    stackable: true  },
  279: { name: 'Gunpowder', stackable: true  },
  280: { name: 'Bow',       stackable: false },
  281: { name: 'Arrow',     stackable: true  },
  // Farming
  282: { name: 'Wooden Hoe',  isTool: true,  stackable: false },
  283: { name: 'Wheat Seeds', stackable: true },
  284: { name: 'Wheat',       foodValue: 5, stackable: true },
  // Mob components
  285: { name: 'Slimeball',   stackable: true },
  // Potions
  286: { name: 'Healing Potion',  potionEffect: 'healing',  stackable: true },
  287: { name: 'Speed Potion',    potionEffect: 'speed',    stackable: true },
  288: { name: 'Strength Potion', potionEffect: 'strength', stackable: true },
  // Misc
  289: { name: 'Blaze Rod',   stackable: true },
};

export function getTooltipText(id: number): string {
  if (id === 0) return '';
  if (id >= 256) {
    const item = ITEMS[id];
    if (!item) return `Item ${id}`;
    const lines = [item.name];
    if (item.attackDamage) lines.push(`Attack: +${item.attackDamage}`);
    if (item.speedMult)    lines.push(`Mining: ${item.speedMult}× speed`);
    if (item.foodValue)    lines.push(`Food: +${item.foodValue}`);
    if (item.armorValue)   lines.push(`Defense: +${item.armorValue}`);
    return lines.join('\n');
  }
  return BLOCKS[id]?.name ?? `Block ${id}`;
}

export function getAnyName(id: number): string {
  if (id === 0) return '';
  if (id >= 256) return ITEMS[id]?.name ?? `Item ${id}`;
  return BLOCKS[id]?.name ?? `Block ${id}`;
}
