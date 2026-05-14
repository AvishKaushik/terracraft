import { create } from 'zustand';
import { WORLD_W, WORLD_H, WORLD_D } from '../lib/constants';

const SPAWN: [number, number, number] = [WORLD_W / 2 + 0.5, WORLD_H + 1, WORLD_D / 2 + 0.5];

export type ArmorSlot = 'head' | 'chest' | 'legs' | 'feet';
export type ArmorState = Record<ArmorSlot, number>; // item ID, 0 = empty

interface PlayerStore {
  pos: [number, number, number];
  vel: [number, number, number];
  yaw: number;
  pitch: number;
  onGround: boolean;
  flying: boolean;
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  dead: boolean;
  spawnPos: [number, number, number];
  armor: ArmorState;
  setPos: (pos: [number, number, number]) => void;
  setVel: (vel: [number, number, number]) => void;
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setOnGround: (v: boolean) => void;
  setFlying: (v: boolean) => void;
  setHealth: (h: number) => void;
  setHunger: (h: number) => void;
  setDead: (v: boolean) => void;
  setSpawnPos: (pos: [number, number, number]) => void;
  setArmorSlot: (slot: ArmorSlot, itemId: number) => void;
  respawn: () => void;
}

export const usePlayerStore = create<PlayerStore>(set => ({
  pos: SPAWN,
  vel: [0, 0, 0],
  yaw: 0,
  pitch: 0,
  onGround: false,
  flying: false,
  health: 20,
  maxHealth: 20,
  hunger: 20,
  maxHunger: 20,
  dead: false,
  spawnPos: SPAWN,
  armor: { head: 0, chest: 0, legs: 0, feet: 0 },
  setPos: pos => set({ pos }),
  setVel: vel => set({ vel }),
  setYaw: yaw => set({ yaw }),
  setPitch: pitch => set({ pitch }),
  setOnGround: onGround => set({ onGround }),
  setFlying: flying => set({ flying }),
  setHealth: health => set({ health: Math.max(0, Math.min(20, health)) }),
  setHunger: hunger => set({ hunger: Math.max(0, Math.min(20, hunger)) }),
  setDead: dead => set({ dead }),
  setSpawnPos: spawnPos => set({ spawnPos }),
  setArmorSlot: (slot, itemId) => set(s => ({ armor: { ...s.armor, [slot]: itemId } })),
  respawn: () => set(s => ({
    dead: false,
    health: 20,
    hunger: 20,
    pos: s.spawnPos,
    vel: [0, 0, 0] as [number, number, number],
  })),
}));
