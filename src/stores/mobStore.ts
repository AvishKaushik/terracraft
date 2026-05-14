import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';

export type MobType = 'cow' | 'zombie' | 'skeleton' | 'creeper' | 'spider' | 'slime';

export interface MobDef { width: number; height: number; }
export const MOB_DEFS: Record<MobType, MobDef> = {
  cow:      { width: 0.9,  height: 1.4 },
  zombie:   { width: 0.6,  height: 1.8 },
  skeleton: { width: 0.6,  height: 1.8 },
  creeper:  { width: 0.6,  height: 1.7 },
  spider:   { width: 1.0,  height: 0.7 },
  slime:    { width: 0.8,  height: 0.8 },
};

// IDs of creepers currently in fuse state (updated at 10 Hz from server)
export const mobFusing = new Set<string>();

export interface MobData {
  id: string;
  type: MobType;
  pos: [number, number, number];
  yaw: number;
  health: number;
  maxHealth: number;
}

// ── Module-level position buffers — updated at 10 Hz, no React re-renders ──
export const mobTargets = new Map<string, { pos: [number, number, number]; yaw: number }>();

// ── React state — only updates on spawn / death / damage ──────────────────
interface MobStore {
  mobs: Map<string, MobData>;
  mobIds: string[];
  upsertMob:       (mob: MobData) => void;
  removeMob:       (id: string) => void;
  updateMobHealth: (id: string, health: number) => void;
  clearMobs:       () => void;
}

export const useMobStore = create<MobStore>((set) => ({
  mobs: new Map(),
  mobIds: [],

  upsertMob: (mob) => set(s => {
    const mobs = new Map(s.mobs);
    mobs.set(mob.id, mob);
    return { mobs, mobIds: [...mobs.keys()] };
  }),

  removeMob: (id) => set(s => {
    const mobs = new Map(s.mobs);
    mobs.delete(id);
    return { mobs, mobIds: [...mobs.keys()] };
  }),

  updateMobHealth: (id, health) => set(s => {
    const mob = s.mobs.get(id);
    if (!mob) return {};
    const mobs = new Map(s.mobs);
    mobs.set(id, { ...mob, health });
    return { mobs };
  }),

  clearMobs: () => set({ mobs: new Map(), mobIds: [] }),
}));

export { useShallow };
