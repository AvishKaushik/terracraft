import { useGameStore } from '../stores/gameStore';

export function HUD() {
  const fps    = useGameStore(s => s.fps);
  const posStr = useGameStore(s => s.posStr);
  const mode   = useGameStore(s => s.mode);

  return (
    <div id="info">
      FPS: {fps}<br />
      XYZ: {posStr}<br />
      Mode: {mode}
    </div>
  );
}
