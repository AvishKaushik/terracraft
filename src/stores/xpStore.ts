import { create } from 'zustand';

interface XpStore {
  xp: number;
  level: number;
  addXp: (amount: number) => void;
  spendLevels: (levels: number) => boolean; // returns false if insufficient
}

const XP_PER_LEVEL = 100;

export const useXpStore = create<XpStore>((set, get) => ({
  xp: 0,
  level: 0,
  addXp: (amount) => set(s => {
    const newXp = s.xp + amount;
    return { xp: newXp, level: Math.floor(newXp / XP_PER_LEVEL) };
  }),
  spendLevels: (levels) => {
    const s = get();
    if (s.level < levels) return false;
    const cost = levels * XP_PER_LEVEL;
    const newXp = Math.max(0, s.xp - cost);
    set({ xp: newXp, level: Math.floor(newXp / XP_PER_LEVEL) });
    return true;
  },
}));

export const XP_PER_LEVEL_CONST = XP_PER_LEVEL;
