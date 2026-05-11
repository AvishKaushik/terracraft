import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useChestStore } from '../stores/chestStore';
import { BLOCKS } from '../lib/blocks';
import { renderBlockIcon } from '../lib/blockIcon';
import { socket } from '../lib/socket';

function SlotCell({
  blockId,
  active,
  empty,
  onClick,
}: {
  blockId: number;
  active: boolean;
  empty: boolean;
  onClick: () => void;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = iconRef.current;
    if (!el || empty) return;
    const existing = el.querySelector('canvas');
    if (existing) el.removeChild(existing);
    el.appendChild(renderBlockIcon(blockId));
  }, [blockId, empty]);

  return (
    <div
      className={`chest-slot${active ? ' active' : ''}${empty ? ' empty' : ''}`}
      onClick={onClick}
      title={empty ? 'Empty' : BLOCKS[blockId]?.name ?? ''}
    >
      {!empty && <div ref={iconRef} />}
    </div>
  );
}

export function ChestUI() {
  const chestOpen    = useGameStore(s => s.chestOpen);
  const setChestOpen = useGameStore(s => s.setChestOpen);
  const hotbar       = useGameStore(s => s.hotbar);
  const currentSlot  = useGameStore(s => s.currentSlot);
  const setHotbarSlot = useGameStore(s => s.setHotbarSlot);

  const { pos, slots, setSlot } = useChestStore();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!chestOpen) return;
      if (e.code === 'KeyE' || e.code === 'Escape') {
        e.preventDefault();
        setChestOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chestOpen, setChestOpen]);

  if (!chestOpen || !pos) return null;

  function handleChestSlotClick(idx: number) {
    if (!pos) return;
    const chestItem = slots[idx];
    const hotbarItem = hotbar[currentSlot];

    // Swap chest slot with current hotbar slot
    setSlot(idx, hotbarItem);
    setHotbarSlot(currentSlot, chestItem);

    socket.emit('chest:set', { x: pos[0], y: pos[1], z: pos[2], idx, blockId: hotbarItem });
  }

  return (
    <div id="chest-screen" onClick={e => { if (e.target === e.currentTarget) setChestOpen(false); }}>
      <div id="chest-panel">
        <div id="chest-title">Chest</div>

        <div className="inv-section-label">Chest contents — click to swap with hotbar slot</div>
        <div id="chest-grid">
          {slots.map((blockId, i) => (
            <SlotCell
              key={i}
              blockId={blockId}
              active={false}
              empty={blockId === 0}
              onClick={() => handleChestSlotClick(i)}
            />
          ))}
        </div>

        <div className="inv-section-label">Your hotbar — selected slot is highlighted</div>
        <div id="chest-hotbar">
          {hotbar.map((blockId, i) => (
            <SlotCell
              key={i}
              blockId={blockId}
              active={i === currentSlot}
              empty={false}
              onClick={() => useGameStore.getState().selectSlot(i)}
            />
          ))}
        </div>

        <div id="chest-hint">E · ESC to close</div>
      </div>
    </div>
  );
}
