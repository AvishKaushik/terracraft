import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getAnyName } from '../lib/items';
import { renderAnyIcon } from '../lib/blockIcon';
import { matchRecipe, RECIPES } from '../lib/recipes';

function AnyIcon({ id, size }: { id: number; size: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const existing = el.querySelector('canvas');
    if (existing) el.removeChild(existing);
    const canvas = renderAnyIcon(id);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.imageRendering = 'pixelated';
    el.appendChild(canvas);
  }, [id, size]);
  return <div ref={ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
}

export function CraftingPanel() {
  const [grid, setGrid] = useState<number[]>(Array(9).fill(0));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  const hotbar         = useGameStore(s => s.hotbar);
  const consumeFromSlot = useGameStore(s => s.consumeFromSlot);
  const addToHotbar    = useGameStore(s => s.addToHotbar);

  const output = matchRecipe(grid);
  const outputName = output ? getAnyName(output) : null;

  // Hotbar items the player actually has (deduplicated by id, with total count)
  const available = hotbar.reduce<Record<number, number>>((acc, sl) => {
    if (sl.id !== 0) acc[sl.id] = (acc[sl.id] ?? 0) + sl.count;
    return acc;
  }, {});

  // Count how many of each id the crafting grid already uses
  const usedInGrid = grid.reduce<Record<number, number>>((acc, id) => {
    if (id !== 0) acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});

  // Whether the player has enough items to actually craft
  const canCraft = output !== null && Object.entries(usedInGrid).every(
    ([id, count]) => (available[Number(id)] ?? 0) >= count
  );

  function fillCell(cellIdx: number, itemId: number) {
    setGrid(g => { const n = [...g]; n[cellIdx] = itemId; return n; });
    setSelectedCell(null);
  }

  function clearCell(cellIdx: number) {
    setGrid(g => { const n = [...g]; n[cellIdx] = 0; return n; });
  }

  function claimOutput() {
    if (!canCraft) return;
    // Consume ingredients from hotbar
    const toConsume = { ...usedInGrid };
    for (let i = 0; i < hotbar.length; i++) {
      const sl = hotbar[i];
      if (!sl || sl.id === 0) continue;
      const need = toConsume[sl.id] ?? 0;
      if (need <= 0) continue;
      const take = Math.min(need, sl.count);
      consumeFromSlot(i, take);
      toConsume[sl.id] -= take;
    }
    addToHotbar(output!, 1);
    setGrid(Array(9).fill(0));
    setSelectedCell(null);
  }

  const hasAnyItems = Object.keys(available).length > 0;

  return (
    <div id="crafting-panel">
      <div id="crafting-area">
        <div id="crafting-grid">
          {grid.map((itemId, i) => (
            <div
              key={i}
              className={`craft-cell${selectedCell === i ? ' selected' : ''}`}
              onClick={() => setSelectedCell(selectedCell === i ? null : i)}
              onContextMenu={e => { e.preventDefault(); clearCell(i); }}
              title={itemId ? getAnyName(itemId) : 'Empty — right-click to clear'}
            >
              {itemId !== 0 && <AnyIcon id={itemId} size={36} />}
            </div>
          ))}
        </div>

        <div id="crafting-arrow">▶</div>

        <div
          id="crafting-output"
          className={canCraft ? 'has-output' : ''}
          onClick={claimOutput}
          title={canCraft ? `Craft ${outputName}` : output ? 'Missing ingredients' : 'No matching recipe'}
        >
          {output && <AnyIcon id={output} size={42} />}
        </div>
      </div>

      <div id="crafting-status">
        {canCraft
          ? `Craft ${outputName} — click output`
          : output
            ? 'Not enough materials'
            : selectedCell !== null
              ? 'Pick an item from your inventory below'
              : 'Click a grid cell, then pick an item'}
      </div>

      {/* Ingredient picker — only shows items the player has */}
      {selectedCell !== null && (
        <div id="crafting-palette">
          <div className="inv-section-label">Your Items — click to fill cell {selectedCell + 1}</div>
          {hasAnyItems ? (
            <div id="crafting-palette-grid">
              {Object.entries(available).map(([idStr, count]) => {
                const id = Number(idStr);
                return (
                  <div
                    key={id}
                    className={`palette-cell${grid[selectedCell] === id ? ' active' : ''}`}
                    onClick={() => fillCell(selectedCell, id)}
                    title={`${getAnyName(id)} ×${count}`}
                  >
                    <AnyIcon id={id} size={28} />
                    <div className="palette-count">×{count}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div id="crafting-status">You have no items yet — go mine something!</div>
          )}
        </div>
      )}

      <div id="crafting-recipes">
        <div className="inv-section-label">Known Recipes</div>
        <div id="recipe-list">
          {RECIPES.map((r, i) => (
            <div key={i} className="recipe-hint">{r.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
