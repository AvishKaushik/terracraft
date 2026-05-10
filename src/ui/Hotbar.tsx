import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { BLOCKS } from '../lib/blocks';
import { renderBlockIcon } from '../lib/blockIcon';

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
      el.appendChild(renderBlockIcon(hotbar[i]));
    });
  }, [hotbar]);

  return (
    <div id="hotbar">
      {hotbar.map((blockId, i) => (
        <div
          key={i}
          className={`slot${i === currentSlot ? ' active' : ''}`}
          onClick={() => selectSlot(i)}
        >
          <div className="num">{i + 1}</div>
          <div ref={el => { iconRefs.current[i] = el; }} />
          <div className="name">{BLOCKS[blockId].name}</div>
        </div>
      ))}
    </div>
  );
}
