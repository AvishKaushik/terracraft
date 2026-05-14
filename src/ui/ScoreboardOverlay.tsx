import { useEffect, useState } from 'react';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useKillFeedStore } from '../stores/killFeedStore';

export function ScoreboardOverlay() {
  const [visible, setVisible] = useState(false);

  const started        = useGameStore(s => s.started);
  const chatOpen       = useGameStore(s => s.chatOpen);
  const inventoryOpen  = useGameStore(s => s.inventoryOpen);
  const players        = useMultiplayerStore(s => s.players);
  const playerIds      = useMultiplayerStore(s => s.playerIds);
  const me             = useAuthStore(s => s.user);
  const myName         = useAuthStore(s => s.username);
  const ownKills       = useKillFeedStore(s => s.entries.filter(e => e.own).length);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      e.preventDefault();
      if (chatOpen || inventoryOpen || !started) return;
      setVisible(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setVisible(false);
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
  const total  = 1 + remote.length;

  return (
    <div id="scoreboard">
      <div className="scoreboard-header">
        <span className="scoreboard-title">Players Online</span>
        <span className="scoreboard-count">{total} / server</span>
      </div>

      <table className="scoreboard-table">
        <thead>
          <tr>
            <th className="sc-col-name">Player</th>
            <th className="sc-col-kills">Kills</th>
            <th className="sc-col-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {/* Local player always first */}
          <tr className="scoreboard-me">
            <td className="sc-col-name">
              <span
                className="sc-dot"
                style={{ background: me?.skinColor ?? '#e8b87a' }}
              />
              {myName}
              <span className="sc-you">YOU</span>
            </td>
            <td className="sc-col-kills">{ownKills > 0 ? `⚔ ${ownKills}` : '—'}</td>
            <td className="sc-col-status sc-online">● online</td>
          </tr>

          {remote.map(p => p && (
            <tr key={p.id}>
              <td className="sc-col-name">
                <span
                  className="sc-dot"
                  style={{ background: p.skinColor ?? '#e8b87a' }}
                />
                {p.name}
              </td>
              <td className="sc-col-kills">—</td>
              <td className="sc-col-status sc-online">● online</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="scoreboard-footer">Hold TAB to view · release to close</div>
    </div>
  );
}
