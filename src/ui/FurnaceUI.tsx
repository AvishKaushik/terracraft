import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { renderAnyIcon } from '../lib/blockIcon';
import { getAnyName } from '../lib/items';

// Smelt recipes: input block/item ID → output item ID
const SMELT: Record<number, number> = {
  266: 267, // Raw Beef → Cooked Beef
};

// Valid fuel IDs and how many smelt ops each provides
const FUEL_VALUE: Record<number, number> = {
  6: 2,  // Oak Log
  7: 1,  // Oak Planks
  28: 4, // Coal Ore
};

function SlotIcon({ id, size = 40 }: { id: number; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const old = el.querySelector('canvas');
    if (old) el.removeChild(old);
    if (id === 0) return;
    const c = renderAnyIcon(id);
    c.style.width = `${size}px`;
    c.style.height = `${size}px`;
    c.style.imageRendering = 'pixelated';
    el.appendChild(c);
  }, [id, size]);
  return <div ref={ref} className="furnace-slot-icon" />;
}

export function FurnaceUI() {
  const furnaceOpen    = useGameStore(s => s.furnaceOpen);
  const setFurnaceOpen = useGameStore(s => s.setFurnaceOpen);
  const hotbar         = useGameStore(s => s.hotbar);
  const currentSlot    = useGameStore(s => s.currentSlot);
  const addToHotbar    = useGameStore(s => s.addToHotbar);
  const consumeFromSlot = useGameStore(s => s.consumeFromSlot);

  const [inputId,  setInputId]  = useState(0);
  const [fuelId,   setFuelId]   = useState(0);

  const outputId  = SMELT[inputId] ?? 0;
  const canSmelt  = outputId !== 0 && FUEL_VALUE[fuelId] !== undefined;

  useEffect(() => {
    if (!furnaceOpen) { setInputId(0); setFuelId(0); }
  }, [furnaceOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!furnaceOpen) return;
      if (e.code === 'KeyE' || e.code === 'Escape') {
        e.preventDefault();
        setFurnaceOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [furnaceOpen, setFurnaceOpen]);

  if (!furnaceOpen) return null;

  const heldId = hotbar[currentSlot]?.id ?? 0;

  function fillInput() {
    if (heldId === 0) return;
    if (SMELT[heldId] !== undefined) {
      setInputId(heldId);
      consumeFromSlot(currentSlot, 1);
    }
  }

  function fillFuel() {
    if (heldId === 0) return;
    if (FUEL_VALUE[heldId] !== undefined) {
      setFuelId(heldId);
      consumeFromSlot(currentSlot, 1);
    }
  }

  function smelt() {
    if (!canSmelt) return;
    addToHotbar(outputId, 1);
    setInputId(0);
    setFuelId(0);
  }

  function returnItem(id: number, setter: (v: number) => void) {
    if (id === 0) return;
    addToHotbar(id, 1);
    setter(0);
  }

  return (
    <div id="furnace-screen" onClick={e => { if (e.target === e.currentTarget) setFurnaceOpen(false); }}>
      <div id="furnace-panel">
        <div id="furnace-title">Furnace</div>

        <div id="furnace-layout">
          {/* Input slot */}
          <div className="furnace-col">
            <div className="furnace-label">Input</div>
            <div
              className={`furnace-slot${inputId ? ' filled' : ''}`}
              onClick={inputId ? () => returnItem(inputId, setInputId) : fillInput}
              title={inputId ? `${getAnyName(inputId)} — click to take back` : 'Click to place held item'}
            >
              <SlotIcon id={inputId} />
              {!inputId && <span className="furnace-slot-hint">+</span>}
            </div>
            <div className="furnace-slot-name">{inputId ? getAnyName(inputId) : '—'}</div>
          </div>

          {/* Flame + arrow */}
          <div className="furnace-col furnace-mid">
            <div id="furnace-flame" className={canSmelt ? 'lit' : ''}>🔥</div>
            <button id="furnace-smelt-btn" disabled={!canSmelt} onClick={smelt}>
              Smelt ▶
            </button>
          </div>

          {/* Output slot */}
          <div className="furnace-col">
            <div className="furnace-label">Output</div>
            <div
              className={`furnace-slot output${outputId ? ' filled' : ''}`}
              onClick={canSmelt ? smelt : undefined}
              title={outputId ? `Click "Smelt" to get ${getAnyName(outputId)}` : 'No recipe'}
            >
              <SlotIcon id={outputId} />
              {!outputId && <span className="furnace-slot-hint">?</span>}
            </div>
            <div className="furnace-slot-name">{outputId ? getAnyName(outputId) : '—'}</div>
          </div>
        </div>

        {/* Fuel slot */}
        <div id="furnace-fuel-row">
          <div className="furnace-label">Fuel</div>
          <div
            className={`furnace-slot${fuelId ? ' filled' : ''}`}
            onClick={fuelId ? () => returnItem(fuelId, setFuelId) : fillFuel}
            title={fuelId ? `${getAnyName(fuelId)} — click to take back` : 'Oak Log, Oak Planks, or Coal Ore'}
          >
            <SlotIcon id={fuelId} />
            {!fuelId && <span className="furnace-slot-hint">+</span>}
          </div>
          <div className="furnace-slot-name">{fuelId ? getAnyName(fuelId) : '—'}</div>
        </div>

        <div id="furnace-hint">
          {canSmelt
            ? `Ready to smelt ${getAnyName(inputId)} → ${getAnyName(outputId)}`
            : 'Place a smeltable item and fuel, then click Smelt'}
        </div>
        <div id="furnace-recipes">
          <span className="inv-section-label">Recipes: </span>
          Raw Beef → Cooked Beef &nbsp;·&nbsp; Fuel: Oak Log / Planks / Coal Ore
        </div>
        <div id="furnace-close-hint">E · ESC to close</div>
      </div>
    </div>
  );
}
