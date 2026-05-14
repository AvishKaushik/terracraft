import { usePlayerStore } from '../stores/playerStore';

export function DeathScreen() {
  const dead   = usePlayerStore(s => s.dead);
  const respawn = usePlayerStore(s => s.respawn);

  if (!dead) return null;

  return (
    <div id="death-screen">
      <div id="death-panel">
        <div id="death-title">You Died!</div>
        <div id="death-subtitle">Your adventure continues…</div>
        <button id="respawn-btn" onClick={respawn}>Respawn</button>
      </div>
    </div>
  );
}
