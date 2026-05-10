import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { BLOCKS } from '../lib/blocks';
import { renderBlockIcon } from '../lib/blockIcon';
import { matchRecipe, RECIPES } from '../lib/recipes';

const ALL_BLOCK_IDS = Object.keys(BLOCKS).map(Number);

function BlockIcon({ blockId, size }: { blockId: number; size: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const existing = el.querySelector('canvas');
    if (existing) el.removeChild(existing);
    const canvas = renderBlockIcon(blockId);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.imageRendering = 'pixelated';
    el.appendChild(canvas);
  }, [blockId, size]);
  return <div ref={ref} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
}

export function CraftingPanel() {
  const [grid, setGrid] = useState<number[]>(Array(9).fill(0));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const currentSlot  = useGameStore(s => s.currentSlot);
  const setHotbarSlot = useGameStore(s => s.setHotbarSlot);

  const output = matchRecipe(grid);

  function fillCell(cellIdx: number, blockId: number) {
    setGrid(g => { const n = [...g]; n[cellIdx] = blockId; return n; });
    setSelectedCell(null);
  }

  function clearCell(cellIdx: number) {
    setGrid(g => { const n = [...g]; n[cellIdx] = 0; return n; });
  }

  function claimOutput() {
    if (!output) return;
    setHotbarSlot(currentSlot, output);
    setGrid(Array(9).fill(0));
    setSelectedCell(null);
  }

  return (
    <div id="crafting-panel">
      {/* 3×3 grid + arrow + output */}
      <div id="crafting-area">
        <div id="crafting-grid">
          {grid.map((blockId, i) => (
            <div
              key={i}
              className={`craft-cell${selectedCell === i ? ' selected' : ''}`}
              onClick={() => setSelectedCell(selectedCell === i ? null : i)}
              onContextMenu={e => { e.preventDefault(); clearCell(i); }}
              title={blockId ? BLOCKS[blockId].name : 'Empty (right-click to clear)'}
            >
              {blockId !== 0 && <BlockIcon blockId={blockId} size={36} />}
            </div>
          ))}
        </div>

        <div id="crafting-arrow">▶</div>

        <div
          id="crafting-output"
          className={output ? 'has-output' : ''}
          onClick={claimOutput}
          title={output ? `Craft ${BLOCKS[output].name} → hotbar slot ${currentSlot + 1}` : 'No matching recipe'}
        >
          {output && <BlockIcon blockId={output} size={42} />}
        </div>
      </div>

      {/* Status line */}
      <div id="crafting-status">
        {output
          ? `✓ ${BLOCKS[output].name} — click output to add to hotbar slot ${currentSlot + 1}`
          : selectedCell !== null
            ? `Slot ${selectedCell + 1} selected — pick a block below`
            : 'Click a grid slot, then pick an ingredient'}
      </div>

      {/* Block palette — visible when a cell is selected */}
      {selectedCell !== null && (
        <div id="crafting-palette">
          <div className="inv-section-label">Ingredients — click to fill slot {selectedCell + 1}</div>
          <div id="crafting-palette-grid">
            {ALL_BLOCK_IDS.map(id => (
              <div
                key={id}
                className={`palette-cell${grid[selectedCell] === id ? ' active' : ''}`}
                onClick={() => fillCell(selectedCell, id)}
                title={BLOCKS[id].name}
              >
                <BlockIcon blockId={id} size={28} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recipe book */}
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
