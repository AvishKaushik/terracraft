interface Recipe {
  ingredients: number[]; // sorted block IDs (shapeless — position in grid doesn't matter)
  output: number;
  label: string;
}

// Block IDs: 1=Grass 2=Dirt 3=Stone 4=Cobblestone 5=Sand 6=OakLog 7=OakPlanks
//            8=Leaves 9=Bricks 10=Glass 11=StoneBricks 12=Snow 13=Gravel 14=Obsidian
//            15=Torch 16=Glowstone 18=Sandstone 28=CoalOre 29=IronOre 31=DiamondOre
// Item IDs:  256=WoodPickaxe 257=StonePickaxe 258=IronPickaxe 259=DiamondPickaxe
//            260=WoodSword 261=StoneSword 262=IronSword 263=DiamondSword
//            264=Bread 265=Apple
export const RECIPES: Recipe[] = [
  // Basic blocks
  { ingredients: [6],              output: 15, label: '1 Oak Log → Torch'              },
  { ingredients: [6, 6, 6, 6],     output: 7,  label: '4 Oak Logs → Oak Planks'        },
  { ingredients: [3, 3, 3, 3],     output: 11, label: '4 Stone → Stone Bricks'         },
  { ingredients: [5, 5, 5, 5],     output: 10, label: '4 Sand → Glass'                 },
  { ingredients: [4, 4],           output: 9,  label: '2 Cobblestone → Bricks'         },
  { ingredients: [13, 13, 13, 13], output: 5,  label: '4 Gravel → Sand'               },
  { ingredients: [10, 6],          output: 16, label: 'Glass + Oak Log → Glowstone'    },
  { ingredients: [7, 7, 7, 7],     output: 9,  label: '4 Oak Planks → Bricks'          },
  // Pickaxes
  { ingredients: [7, 7, 7],        output: 256, label: '3 Oak Planks → Wooden Pickaxe' },
  { ingredients: [4, 4, 4],        output: 257, label: '3 Cobblestone → Stone Pickaxe' },
  { ingredients: [29, 29, 29],     output: 258, label: '3 Iron Ore → Iron Pickaxe'     },
  { ingredients: [31, 31, 31],     output: 259, label: '3 Diamond Ore → Diamond Pickaxe' },
  // Swords (head material × 2 + Oak Planks handle)
  { ingredients: [7, 7],           output: 260, label: '2 Oak Planks → Wooden Sword'           },
  { ingredients: [4, 4, 7],        output: 261, label: '2 Cobblestone + Oak Planks → Stone Sword'   },
  { ingredients: [7, 29, 29],      output: 262, label: '2 Iron Ore + Oak Planks → Iron Sword'       },
  { ingredients: [7, 31, 31],      output: 263, label: '2 Diamond Ore + Oak Planks → Diamond Sword' },
  // Food
  { ingredients: [8, 8],           output: 265, label: '2 Leaves → Apple'              },
  { ingredients: [5, 5, 5],        output: 264, label: '3 Sand → Bread'                },
  // Bed & Furnace
  { ingredients: [22, 22, 22],     output: 33,  label: '3 Red Wool → Bed'              },
  { ingredients: [4, 4, 4, 4],     output: 34,  label: '4 Cobblestone → Furnace'       },
  // Iron armor (2/4/5/6 iron ore per piece)
  { ingredients: [29, 29],                   output: 273, label: '2 Iron Ore → Iron Boots'        },
  { ingredients: [29, 29, 29, 29],           output: 270, label: '4 Iron Ore → Iron Helmet'       },
  { ingredients: [29, 29, 29, 29, 29],       output: 272, label: '5 Iron Ore → Iron Leggings'     },
  { ingredients: [29, 29, 29, 29, 29, 29],   output: 271, label: '6 Iron Ore → Iron Chestplate'   },
  // Diamond armor (2/4/5/6 diamond ore per piece)
  { ingredients: [31, 31],                   output: 277, label: '2 Diamond Ore → Diamond Boots'      },
  { ingredients: [31, 31, 31, 31],           output: 274, label: '4 Diamond Ore → Diamond Helmet'     },
  { ingredients: [31, 31, 31, 31, 31],       output: 276, label: '5 Diamond Ore → Diamond Leggings'   },
  { ingredients: [31, 31, 31, 31, 31, 31],   output: 275, label: '6 Diamond Ore → Diamond Chestplate' },
  // Bow & arrows
  { ingredients: [23, 23],               output: 278, label: '2 White Wool → String'            },
  { ingredients: [7, 7, 7, 278, 278],    output: 280, label: '3 Oak Planks + 2 String → Bow'   },
  { ingredients: [13, 7],               output: 281, label: 'Gravel + Oak Planks → Arrow'      },
  // Farming
  { ingredients: [7, 7],                 output: 282, label: '2 Oak Planks → Wooden Hoe'       },
  // Enchanting & Brewing
  { ingredients: [7, 7, 14, 14],         output: 43,  label: '2 Oak Planks + 2 Obsidian → Enchanting Table' },
  { ingredients: [7, 29, 29],            output: 44,  label: 'Oak Planks + 2 Iron Ore → Brewing Stand'      },
  // Potions (brewed with slimeball base)
  { ingredients: [285, 265],             output: 286, label: 'Slimeball + Apple → Healing Potion'   },
  { ingredients: [285, 264],             output: 287, label: 'Slimeball + Bread → Speed Potion'     },
  { ingredients: [285, 268],             output: 288, label: 'Slimeball + Rotten Flesh → Strength Potion' },
];

export function matchRecipe(grid: number[]): number | null {
  const ingredients = grid.filter(id => id !== 0).sort((a, b) => a - b);
  if (ingredients.length === 0) return null;
  for (const recipe of RECIPES) {
    const sorted = [...recipe.ingredients].sort((a, b) => a - b);
    if (sorted.length === ingredients.length && sorted.every((id, i) => id === ingredients[i])) {
      return recipe.output;
    }
  }
  return null;
}

export function recipeHint(grid: number[]): string | null {
  const ingredients = grid.filter(id => id !== 0).sort((a, b) => a - b);
  if (ingredients.length === 0) return null;
  for (const recipe of RECIPES) {
    const sorted = [...recipe.ingredients].sort((a, b) => a - b);
    if (sorted.length === ingredients.length && sorted.every((id, i) => id === ingredients[i])) {
      return recipe.label;
    }
  }
  return null;
}
