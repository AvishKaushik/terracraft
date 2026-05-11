import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { BLOCKS } from '../lib/blocks';

export function HotbarToast() {
  const currentSlot = useGameStore(s => s.currentSlot);
  const hotbar      = useGameStore(s => s.hotbar);
  const started     = useGameStore(s => s.started);
  const [label, setLabel]   = useState('');
  const [visible, setVisible] = useState(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout>>(undefined);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (!started) return;
    const name = BLOCKS[hotbar[currentSlot]]?.name;
    if (!name) return;
    setLabel(name);
    setVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 1600);
  }, [currentSlot, hotbar, started]);

  if (!started) return null;

  return (
    <div id="hotbar-toast" className={visible ? 'show' : ''}>
      {label}
    </div>
  );
}
