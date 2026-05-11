import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';

export function SettingsScreen() {
  const settingsOpen    = useGameStore(s => s.settingsOpen);
  const setSettingsOpen = useGameStore(s => s.setSettingsOpen);

  const sensitivity    = useSettingsStore(s => s.sensitivity);
  const renderDistance = useSettingsStore(s => s.renderDistance);
  const baseFov        = useSettingsStore(s => s.baseFov);
  const volume         = useSettingsStore(s => s.volume);
  const setSensitivity    = useSettingsStore(s => s.setSensitivity);
  const setRenderDistance = useSettingsStore(s => s.setRenderDistance);
  const setBaseFov        = useSettingsStore(s => s.setBaseFov);
  const setVolume         = useSettingsStore(s => s.setVolume);

  if (!settingsOpen) return null;

  return (
    <div id="settings-overlay">
      <div className="mc-panel settings-panel">
        <div className="settings-title">Settings</div>

        <div className="setting-row">
          <span className="setting-label">Mouse Sensitivity</span>
          <input
            className="setting-slider"
            type="range" min={0.0005} max={0.005} step={0.0001}
            value={sensitivity}
            onChange={e => setSensitivity(Number(e.target.value))}
          />
          <span className="setting-value">{Math.round(sensitivity / 0.0022 * 100)}%</span>
        </div>

        <div className="setting-row">
          <span className="setting-label">Render Distance</span>
          <input
            className="setting-slider"
            type="range" min={30} max={160} step={10}
            value={renderDistance}
            onChange={e => setRenderDistance(Number(e.target.value))}
          />
          <span className="setting-value">{renderDistance}m</span>
        </div>

        <div className="setting-row">
          <span className="setting-label">Field of View</span>
          <input
            className="setting-slider"
            type="range" min={50} max={110} step={1}
            value={baseFov}
            onChange={e => setBaseFov(Number(e.target.value))}
          />
          <span className="setting-value">{baseFov}°</span>
        </div>

        <div className="setting-row">
          <span className="setting-label">Volume</span>
          <input
            className="setting-slider"
            type="range" min={0} max={1} step={0.05}
            value={volume}
            onChange={e => setVolume(Number(e.target.value))}
          />
          <span className="setting-value">{Math.round(volume * 100)}%</span>
        </div>

        <button className="pre-btn" style={{ marginTop: 14 }} onClick={() => setSettingsOpen(false)}>
          Done
        </button>
      </div>
    </div>
  );
}
