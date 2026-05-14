import { useGameStore } from '../stores/gameStore';
import { ITEMS } from '../lib/items';
import { RECIPES } from '../lib/recipes';

const POTION_RECIPES = RECIPES.filter(r => ITEMS[r.output]?.potionEffect !== undefined);

export function BrewingUI() {
  const brewingOpen     = useGameStore(s => s.brewingOpen);
  const setBrewingOpen  = useGameStore(s => s.setBrewingOpen);
  const hotbar          = useGameStore(s => s.hotbar);
  const currentSlot     = useGameStore(s => s.currentSlot);
  const consumeFromSlot = useGameStore(s => s.consumeFromSlot);
  const addToHotbar     = useGameStore(s => s.addToHotbar);

  if (!brewingOpen) return null;

  function tryBrew(outputId: number, ingredients: number[]) {
    const sorted    = [...ingredients].sort((a, b) => a - b);
    const remaining = hotbar.map(s => s?.id ?? 0).filter(id => id !== 0).sort((a, b) => a - b);
    for (const ing of sorted) {
      const idx = remaining.indexOf(ing);
      if (idx === -1) return;
      remaining.splice(idx, 1);
    }
    for (const ing of sorted) {
      const slotIdx = hotbar.findIndex(s => s?.id === ing);
      if (slotIdx !== -1) consumeFromSlot(slotIdx);
    }
    addToHotbar(outputId, 1);
    setBrewingOpen(false);
  }

  const heldId   = hotbar[currentSlot]?.id ?? 0;
  const heldName = heldId >= 256 ? (ITEMS[heldId]?.name ?? '') : '';

  return (
    <div id="brewing-ui">
      <div className="ui-panel-header">
        <span className="ui-title">Brewing Stand</span>
      </div>
      <div className="ui-panel-body">
        <div className="brewing-held">Held: <strong>{heldName || 'Nothing'}</strong></div>
        <div className="brewing-recipes">
          {POTION_RECIPES.map(r => {
            const outItem = ITEMS[r.output];
            if (!outItem) return null;
            return (
              <button key={r.output} className="brew-recipe" onClick={() => tryBrew(r.output, r.ingredients)}>
                <span className="brew-output">{outItem.name}</span>
                <span className="brew-label">{r.label}</span>
              </button>
            );
          })}
        </div>
        <button className="ui-close-btn" onClick={() => setBrewingOpen(false)}>Close</button>
      </div>
    </div>
  );
}
