import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { getAnyName, getTooltipText } from '../lib/items';
import { renderAnyIcon } from '../lib/blockIcon';

export function Hotbar() {
  const currentSlot = useGameStore(s => s.currentSlot);
  const selectSlot  = useGameStore(s => s.selectSlot);
  const hotbar      = useGameStore(s => s.hotbar);
  const iconRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    iconRefs.current.forEach((el, i) => {
      if (!el) return;
      const existing = el.querySelector('canvas');
      if (existing) el.removeChild(existing);
      el.appendChild(renderAnyIcon(hotbar[i].id));
    });
  }, [hotbar]);

  return (
    <div id="hotbar">
      {hotbar.map((slot, i) => (
        <div
          key={i}
          className={`slot${i === currentSlot ? ' active' : ''}`}
          onClick={() => selectSlot(i)}
          data-tooltip={getTooltipText(slot.id)}
        >
          <div className="num">{i + 1}</div>
          <div ref={el => { iconRefs.current[i] = el; }} />
          {slot.id !== 0 && slot.count > 1 && (
            <div className="slot-count">{slot.count}</div>
          )}
          <div className="name">{getAnyName(slot.id)}</div>
        </div>
      ))}
    </div>
  );
}
