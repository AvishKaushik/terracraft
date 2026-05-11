import { useEffect, useRef, useState } from 'react';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

export function PlayerList() {
  const [visible, setVisible] = useState(false);
  const tabHeld = useRef(false);

  const started      = useGameStore(s => s.started);
  const chatOpen     = useGameStore(s => s.chatOpen);
  const inventoryOpen = useGameStore(s => s.inventoryOpen);
  const players      = useMultiplayerStore(s => s.players);
  const playerIds    = useMultiplayerStore(s => s.playerIds);
  const me           = useAuthStore(s => s.user);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      e.preventDefault();
      if (chatOpen || inventoryOpen || !started) return;
      if (!tabHeld.current) { tabHeld.current = true; setVisible(true); }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      tabHeld.current = false;
      setVisible(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [started, chatOpen, inventoryOpen]);

  if (!visible || !started) return null;

  const remote = playerIds.map(id => players.get(id)).filter(Boolean);

  return (
    <div id="player-list">
      <div className="player-list-panel">
        <div className="player-list-title">Players Online</div>
        <ul className="player-list-entries">
          {me && (
            <li className="player-list-entry player-list-me">
              <span className="player-dot" style={{ background: me.skinColor }} />
              {me.username} <span className="player-list-you">(you)</span>
            </li>
          )}
          {remote.map(p => p && (
            <li key={p.id} className="player-list-entry">
              <span className="player-dot" style={{ background: p.skinColor }} />
              {p.name}
            </li>
          ))}
        </ul>
        <div className="player-list-count">{1 + remote.length} online</div>
      </div>
    </div>
  );
}
