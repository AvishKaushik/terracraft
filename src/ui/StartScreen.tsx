import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

interface Props { canvasEl: HTMLCanvasElement | null; }

export function StartScreen({ canvasEl }: Props) {
  const started    = useGameStore(s => s.started);
  const worldReady = useGameStore(s => s.worldReady);
  const start      = useGameStore(s => s.start);
  const serverName = useAuthStore(s => s.serverName);

  const handlePlay = () => {
    start();
    canvasEl?.requestPointerLock();
  };

  return (
    <div id="start-screen" className={started ? 'hidden' : ''}>
      <h1>TERRA&nbsp;CRAFT</h1>
      <div className="subtitle">{serverName ?? 'build · mine · explore'}</div>

      {!worldReady ? (
        <div className="mc-panel" style={{ marginBottom: 20, textAlign: 'center' }}>
          <div className="world-loading-text">Loading world</div>
          <div className="world-loading-dots"><span /><span /><span /></div>
        </div>
      ) : (
        <div className="mc-panel" style={{ marginBottom: 20 }}>
          <div className="controls">
            <div className="row"><span className="label">Move</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div>
            <div className="row"><span className="label">Jump / Sprint</span><span><kbd>Space</kbd> · <kbd>Shift</kbd></span></div>
            <div className="row"><span className="label">Look</span><span><kbd>Mouse</kbd></span></div>
            <div className="row"><span className="label">Break · Place</span><span><kbd>L-Click</kbd> · <kbd>R-Click</kbd></span></div>
            <div className="row"><span className="label">Select block</span><span><kbd>1</kbd> – <kbd>9</kbd> · <kbd>Scroll</kbd></span></div>
            <div className="row"><span className="label">Fly toggle</span><span>double-tap <kbd>Space</kbd></span></div>
            <div className="row"><span className="label">Chat</span><span><kbd>T</kbd></span></div>
            <div className="row"><span className="label">Inventory</span><span><kbd>E</kbd></span></div>
            <div className="row"><span className="label">Player list</span><span>hold <kbd>Tab</kbd></span></div>
          </div>
        </div>
      )}

      <button id="start-button" onClick={handlePlay} disabled={!worldReady}>
        {worldReady ? 'Click to Play' : 'Connecting…'}
      </button>
    </div>
  );
}
