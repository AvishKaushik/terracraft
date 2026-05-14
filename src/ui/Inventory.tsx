import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore, type ArmorSlot } from '../stores/playerStore';
import { getAnyName, getTooltipText, ITEMS } from '../lib/items';
import { renderAnyIcon } from '../lib/blockIcon';
import { CraftingPanel } from './CraftingPanel';

function HotbarSlotCell({ slotId, slotCount, slotIndex, active, onSelectSlot }: {
  slotId: number; slotCount: number; slotIndex: number; active: boolean; onSelectSlot: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = iconRef.current;
    if (!el) return;
    const existing = el.querySelector('canvas');
    if (existing) el.removeChild(existing);
    el.appendChild(renderAnyIcon(slotId));
  }, [slotId]);

  return (
    <div
      className={`slot${active ? ' active' : ''}`}
      onClick={onSelectSlot}
      data-tooltip={getTooltipText(slotId)}
    >
      <div className="num">{slotIndex + 1}</div>
      <div ref={iconRef} />
      {slotId !== 0 && slotCount > 1 && <div className="slot-count">{slotCount}</div>}
      <div className="name">{getAnyName(slotId)}</div>
    </div>
  );
}

const ARMOR_SLOT_LABELS: Record<ArmorSlot, string> = {
  head: 'Head', chest: 'Chest', legs: 'Legs', feet: 'Feet',
};
const ARMOR_SLOTS: ArmorSlot[] = ['head', 'chest', 'legs', 'feet'];

function ArmorSlotCell({ slot, equippedId, onEquip, onUnequip }: {
  slot: ArmorSlot; equippedId: number;
  onEquip: () => void; onUnequip: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = iconRef.current;
    if (!el) return;
    const old = el.querySelector('canvas');
    if (old) el.removeChild(old);
    if (!equippedId) return;
    const c = renderAnyIcon(equippedId);
    c.style.width = '36px'; c.style.height = '36px';
    c.style.imageRendering = 'pixelated';
    el.appendChild(c);
  }, [equippedId]);

  return (
    <div
      className={`armor-slot${equippedId ? ' equipped' : ''}`}
      onClick={equippedId ? onUnequip : onEquip}
      data-tooltip={equippedId ? getTooltipText(equippedId) : `${ARMOR_SLOT_LABELS[slot]} armor`}
    >
      <div className="armor-slot-label">{ARMOR_SLOT_LABELS[slot]}</div>
      <div ref={iconRef} className="armor-slot-icon">
        {!equippedId && <span className="armor-slot-empty">{ARMOR_SLOT_LABELS[slot][0]}</span>}
      </div>
    </div>
  );
}

export function Inventory() {
  const inventoryOpen    = useGameStore(s => s.inventoryOpen);
  const setInventoryOpen = useGameStore(s => s.setInventoryOpen);
  const hotbar           = useGameStore(s => s.hotbar);
  const currentSlot      = useGameStore(s => s.currentSlot);
  const selectSlot       = useGameStore(s => s.selectSlot);
  const consumeFromSlot  = useGameStore(s => s.consumeFromSlot);
  const addToHotbar      = useGameStore(s => s.addToHotbar);
  const armor            = usePlayerStore(s => s.armor);
  const setArmorSlot     = usePlayerStore(s => s.setArmorSlot);

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
        <div className="ui-panel-header" id="inv-header">
          <span className="ui-title">{activeTab === 'inventory' ? 'Inventory' : 'Crafting Table'}</span>
          <button className="ui-close-btn inv-close-btn" onClick={() => setInventoryOpen(false)}>✕</button>
        </div>

        <div className="ui-panel-body" id="inv-body">
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
              Crafting
            </button>
          </div>

          {activeTab === 'inventory' ? (
            <>
              <div className="inv-section-label">Armor</div>
              <div id="armor-row">
                {ARMOR_SLOTS.map(slot => (
                  <ArmorSlotCell
                    key={slot}
                    slot={slot}
                    equippedId={armor[slot]}
                    onEquip={() => {
                      const heldId = hotbar[currentSlot]?.id ?? 0;
                      const item = ITEMS[heldId];
                      if (!item || item.armorSlot !== slot) return;
                      if (armor[slot]) addToHotbar(armor[slot], 1);
                      setArmorSlot(slot, heldId);
                      consumeFromSlot(currentSlot, 1);
                    }}
                    onUnequip={() => {
                      addToHotbar(armor[slot], 1);
                      setArmorSlot(slot, 0);
                    }}
                  />
                ))}
              </div>

              <div className="inv-section-label">Hotbar</div>
              <div id="inventory-hotbar">
                {hotbar.map((slot, i) => (
                  <HotbarSlotCell
                    key={i}
                    slotId={slot.id}
                    slotCount={slot.count}
                    slotIndex={i}
                    active={i === currentSlot}
                    onSelectSlot={() => selectSlot(i)}
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
    </div>
  );
}
