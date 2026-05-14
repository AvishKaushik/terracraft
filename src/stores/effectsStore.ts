import { create } from 'zustand';

interface EffectsStore {
  speedBoost: number;    // seconds remaining
  strengthBoost: number;
  healingPulse: number;  // healing pulses remaining (each restores 2HP)
  tick: (dt: number) => void;
  applyPotion: (type: 'healing' | 'speed' | 'strength') => void;
}

export const useEffectsStore = create<EffectsStore>((set) => ({
  speedBoost: 0,
  strengthBoost: 0,
  healingPulse: 0,
  tick: (dt) => set(s => ({
    speedBoost:    Math.max(0, s.speedBoost    - dt),
    strengthBoost: Math.max(0, s.strengthBoost - dt),
  })),
  applyPotion: (type) => {
    if (type === 'healing')  set(s => ({ healingPulse: s.healingPulse + 3 }));
    if (type === 'speed')    set({ speedBoost:    30 });
    if (type === 'strength') set({ strengthBoost: 30 });
  },
}));
