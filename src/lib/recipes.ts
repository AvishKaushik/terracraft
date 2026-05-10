interface Recipe {
  ingredients: number[]; // sorted block IDs (shapeless — position in grid doesn't matter)
  output: number;
  label: string; // human-readable hint
}

// Block IDs: 1=Grass 2=Dirt 3=Stone 4=Cobblestone 5=Sand 6=OakLog 7=OakPlanks
//            8=Leaves 9=Bricks 10=Glass 11=StoneBricks 12=Snow 13=Gravel 14=Obsidian
//            15=Torch 16=Glowstone
export const RECIPES: Recipe[] = [
  { ingredients: [6],              output: 15, label: '1 Oak Log → Torch'          },
  { ingredients: [6, 6, 6, 6],     output: 7,  label: '4 Oak Logs → Oak Planks'    },
  { ingredients: [3, 3, 3, 3],     output: 11, label: '4 Stone → Stone Bricks'     },
  { ingredients: [5, 5, 5, 5],     output: 10, label: '4 Sand → Glass'             },
  { ingredients: [4, 4],           output: 9,  label: '2 Cobblestone → Bricks'     },
  { ingredients: [13, 13, 13, 13], output: 5,  label: '4 Gravel → Sand'            },
  { ingredients: [10, 6],          output: 16, label: 'Glass + Oak Log → Glowstone' },
  { ingredients: [7, 7, 7, 7],     output: 9,  label: '4 Oak Planks → Bricks'      },
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
