import { create } from 'zustand';

const DEFAULTS = { sensitivity: 0.0022, renderDistance: 90, baseFov: 70, volume: 0.7 };

const stored = (() => {
  try { return JSON.parse(localStorage.getItem('tc_settings') ?? '{}'); }
  catch { return {}; }
})();

interface SettingsStore {
  sensitivity:    number;
  renderDistance: number;
  baseFov:        number;
  volume:         number;
  setSensitivity:    (v: number) => void;
  setRenderDistance: (v: number) => void;
  setBaseFov:        (v: number) => void;
  setVolume:         (v: number) => void;
}

function persist(key: string, value: number) {
  try {
    const s = JSON.parse(localStorage.getItem('tc_settings') ?? '{}');
    s[key] = value;
    localStorage.setItem('tc_settings', JSON.stringify(s));
  } catch { /* ignore */ }
}

export const useSettingsStore = create<SettingsStore>(set => ({
  sensitivity:    stored.sensitivity    ?? DEFAULTS.sensitivity,
  renderDistance: stored.renderDistance ?? DEFAULTS.renderDistance,
  baseFov:        stored.baseFov        ?? DEFAULTS.baseFov,
  volume:         stored.volume         ?? DEFAULTS.volume,

  setSensitivity:    v => { set({ sensitivity: v });    persist('sensitivity', v); },
  setRenderDistance: v => { set({ renderDistance: v }); persist('renderDistance', v); },
  setBaseFov:        v => { set({ baseFov: v });        persist('baseFov', v); },
  setVolume:         v => { set({ volume: v });         persist('volume', v); },
}));
