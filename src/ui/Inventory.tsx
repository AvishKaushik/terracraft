import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { BLOCKS } from '../lib/blocks';
import { renderBlockIcon } from '../lib/blockIcon';
import { CraftingPanel } from './CraftingPanel';

const ALL_BLOCK_IDS = Object.keys(BLOCKS).map(Number);

function BlockCell({ blockId, active, onClick }: { blockId: number; active: boolean; onClick: () => void }) {
  const iconRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = iconRef.current;
    if (!el) return;
    const existing = el.querySelector('canvas');
    if (existing) el.removeChild(existing);
    el.appendChild(renderBlockIcon(blockId));
  }, [blockId]);

  return (
    <div className={`inv-cell${active ? ' active' : ''}`} onClick={onClick} title={BLOCKS[blockId].name}>
      <div ref={iconRef} />
      <div className="inv-cell-name">{BLOCKS[blockId].name}</div>
    </div>
  );
}

function HotbarSlot({ blockId, slotIndex, active, onSelectSlot }: {
  blockId: number; slotIndex: number; active: boolean; onSelectSlot: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = iconRef.current;
    if (!el) return;
    const existing = el.querySelector('canvas');
    if (existing) el.removeChild(existing);
    el.appendChild(renderBlockIcon(blockId));
  }, [blockId]);

  return (
    <div className={`slot${active ? ' active' : ''}`} onClick={onSelectSlot}>
      <div className="num">{slotIndex + 1}</div>
      <div ref={iconRef} />
      <div className="name">{BLOCKS[blockId].name}</div>
    </div>
  );
}

export function Inventory() {
  const inventoryOpen    = useGameStore(s => s.inventoryOpen);
  const setInventoryOpen = useGameStore(s => s.setInventoryOpen);
  const hotbar           = useGameStore(s => s.hotbar);
  const currentSlot      = useGameStore(s => s.currentSlot);
  const selectSlot       = useGameStore(s => s.selectSlot);
  const setHotbarSlot    = useGameStore(s => s.setHotbarSlot);

  const [activeTab, setActiveTab] = useState<'inventory' | 'crafting'>('inventory');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!inventoryOpen) return;
      if (e.code === 'KeyE' || e.code === 'Escape') {
        e.preventDefault();
        setInventoryOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inventoryOpen, setInventoryOpen]);

  if (!inventoryOpen) return null;

  return (
    <div id="inventory-screen" onClick={e => { if (e.target === e.currentTarget) setInventoryOpen(false); }}>
      <div id="inventory-panel">
        {/* Tab bar */}
        <div id="inv-tabs">
          <button
            className={`inv-tab${activeTab === 'inventory' ? ' active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            Inventory
          </button>
          <button
            className={`inv-tab${activeTab === 'crafting' ? ' active' : ''}`}
            onClick={() => setActiveTab('crafting')}
          >
            Crafting ⚒
          </button>
        </div>

        {activeTab === 'inventory' ? (
          <>
            <div className="inv-section-label">Hotbar — click a slot to select it</div>
            <div id="inventory-hotbar">
              {hotbar.map((blockId, i) => (
                <HotbarSlot
                  key={i}
                  blockId={blockId}
                  slotIndex={i}
                  active={i === currentSlot}
                  onSelectSlot={() => selectSlot(i)}
                />
              ))}
            </div>

            <div className="inv-section-label">All Blocks — click to place in selected slot</div>
            <div id="inventory-grid">
              {ALL_BLOCK_IDS.map(id => (
                <BlockCell
                  key={id}
                  blockId={id}
                  active={hotbar[currentSlot] === id}
                  onClick={() => setHotbarSlot(currentSlot, id)}
                />
              ))}
            </div>
          </>
        ) : (
          <CraftingPanel />
        )}

        <div id="inventory-hint">E · ESC to close</div>
      </div>
    </div>
  );
}
