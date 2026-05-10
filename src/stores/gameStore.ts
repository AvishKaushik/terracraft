import { create } from 'zustand';
import { DEFAULT_HOTBAR } from '../lib/blocks';

interface GameStore {
  started: boolean;
  mouseLocked: boolean;
  chatOpen: boolean;
  inventoryOpen: boolean;
  currentSlot: number;
  hotbar: number[];
  fps: number;
  posStr: string;
  mode: string;
  start: () => void;
  setMouseLocked: (v: boolean) => void;
  setChatOpen: (v: boolean) => void;
  setInventoryOpen: (v: boolean) => void;
  selectSlot: (i: number) => void;
  setHotbarSlot: (slot: number, blockId: number) => void;
  setStats: (fps: number, posStr: string, mode: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  started: false,
  mouseLocked: false,
  chatOpen: false,
  inventoryOpen: false,
  currentSlot: 0,
  hotbar: [...DEFAULT_HOTBAR],
  fps: 0,
  posStr: '',
  mode: '',
  start: () => set({ started: true }),
  setMouseLocked: mouseLocked => set({ mouseLocked }),
  setChatOpen: chatOpen => set({ chatOpen }),
  setInventoryOpen: inventoryOpen => set({ inventoryOpen }),
  selectSlot: currentSlot => {
    const len = get().hotbar.length;
    set({ currentSlot: ((currentSlot % len) + len) % len });
  },
  setHotbarSlot: (slot, blockId) => set(s => {
    const hotbar = [...s.hotbar];
    hotbar[slot] = blockId;
    return { hotbar };
  }),
  setStats: (fps, posStr, mode) => set({ fps, posStr, mode }),
}));
