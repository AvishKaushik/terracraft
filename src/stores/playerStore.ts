import { create } from 'zustand';
import { WORLD_W, WORLD_H, WORLD_D } from '../lib/constants';

interface PlayerStore {
  pos: [number, number, number];
  vel: [number, number, number];
  yaw: number;
  pitch: number;
  onGround: boolean;
  flying: boolean;
  setPos: (pos: [number, number, number]) => void;
  setVel: (vel: [number, number, number]) => void;
  setYaw: (yaw: number) => void;
  setPitch: (pitch: number) => void;
  setOnGround: (v: boolean) => void;
  setFlying: (v: boolean) => void;
}

export const usePlayerStore = create<PlayerStore>(set => ({
  pos: [WORLD_W / 2 + 0.5, WORLD_H + 1, WORLD_D / 2 + 0.5],
  vel: [0, 0, 0],
  yaw: 0,
  pitch: 0,
  onGround: false,
  flying: false,
  setPos: pos => set({ pos }),
  setVel: vel => set({ vel }),
  setYaw: yaw => set({ yaw }),
  setPitch: pitch => set({ pitch }),
  setOnGround: onGround => set({ onGround }),
  setFlying: flying => set({ flying }),
}));
