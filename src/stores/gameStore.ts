import { create } from 'zustand';
import { ITEMS } from '../lib/items';

export type Enchants = Partial<{ Sharpness: number; Efficiency: number; Protection: number }>;
export type HotbarSlot = { id: number; count: number; enchants?: Enchants };

function makeDefaultHotbar(): HotbarSlot[] {
  return Array(9).fill(null).map(() => ({ id: 0, count: 0 }));
}

const MAX_STACK = 64;

interface GameStore {
  started: boolean;
  worldReady: boolean;
  mouseLocked: boolean;
  chatOpen: boolean;
  inventoryOpen: boolean;
  settingsOpen: boolean;
  chestOpen: boolean;
  furnaceOpen: boolean;
  furnacePos: [number, number, number] | null;
  enchantingOpen: boolean;
  enchantingPos: [number, number, number] | null;
  brewingOpen: boolean;
  brewingPos: [number, number, number] | null;
  currentSlot: number;
  hotbar: HotbarSlot[];
  fps: number;
  posStr: string;
  mode: string;
  start: () => void;
  setWorldReady: (v: boolean) => void;
  setMouseLocked: (v: boolean) => void;
  setChatOpen: (v: boolean) => void;
  setInventoryOpen: (v: boolean) => void;
  setSettingsOpen: (v: boolean) => void;
  setChestOpen: (v: boolean) => void;
  setFurnaceOpen: (v: boolean, pos?: [number, number, number]) => void;
  setEnchantingOpen: (v: boolean, pos?: [number, number, number]) => void;
  setBrewingOpen: (v: boolean, pos?: [number, number, number]) => void;
  applyEnchant: (slot: number, name: keyof Enchants, level: number) => void;
  selectSlot: (i: number) => void;
  setHotbarSlot: (slot: number, id: number, count?: number) => void;
  addToHotbar: (id: number, count?: number) => void;
  consumeFromSlot: (slot: number, count?: number) => void;
  setHotbar: (slots: HotbarSlot[]) => void;
  setStats: (fps: number, posStr: string, mode: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  started: false,
  worldReady: false,
  mouseLocked: false,
  chatOpen: false,
  inventoryOpen: false,
  settingsOpen: false,
  chestOpen: false,
  furnaceOpen: false,
  furnacePos: null,
  enchantingOpen: false,
  enchantingPos: null,
  brewingOpen: false,
  brewingPos: null,
  currentSlot: 0,
  hotbar: makeDefaultHotbar(),
  fps: 0,
  posStr: '',
  mode: '',
  start: () => set({ started: true }),
  setWorldReady: worldReady => set({ worldReady }),
  setMouseLocked: mouseLocked => set({ mouseLocked }),
  setChatOpen: chatOpen => set({ chatOpen }),
  setInventoryOpen: inventoryOpen => set({ inventoryOpen }),
  setSettingsOpen: settingsOpen => set({ settingsOpen }),
  setChestOpen: chestOpen => set({ chestOpen }),
  setFurnaceOpen: (furnaceOpen, furnacePos) => set(s => ({
    furnaceOpen,
    furnacePos: furnacePos ?? s.furnacePos,
  })),
  setEnchantingOpen: (enchantingOpen, enchantingPos) => set(s => ({
    enchantingOpen,
    enchantingPos: enchantingPos ?? s.enchantingPos,
  })),
  setBrewingOpen: (brewingOpen, brewingPos) => set(s => ({
    brewingOpen,
    brewingPos: brewingPos ?? s.brewingPos,
  })),
  applyEnchant: (slot, name, level) => set(s => {
    const hotbar = [...s.hotbar];
    const sl = hotbar[slot];
    if (!sl) return {};
    hotbar[slot] = { ...sl, enchants: { ...sl.enchants, [name]: level } };
    return { hotbar };
  }),
  selectSlot: currentSlot => {
    const len = get().hotbar.length;
    set({ currentSlot: ((currentSlot % len) + len) % len });
  },
  setHotbarSlot: (slot, id, count = 1) => set(s => {
    const hotbar = [...s.hotbar];
    hotbar[slot] = { id, count };
    return { hotbar };
  }),
  addToHotbar: (id, count = 1) => {
    const s = get();
    const hotbar = [...s.hotbar];
    const stackable = id < 256 || (ITEMS[id]?.stackable ?? false);
    if (stackable) {
      const existing = hotbar.findIndex(sl => sl.id === id && sl.count < MAX_STACK);
      if (existing >= 0) {
        hotbar[existing] = { id, count: Math.min(MAX_STACK, hotbar[existing].count + count) };
        set({ hotbar });
        return;
      }
    }
    const empty = hotbar.findIndex(sl => sl.id === 0);
    if (empty >= 0) {
      hotbar[empty] = { id, count };
      set({ hotbar });
    }
  },
  consumeFromSlot: (slot, count = 1) => set(s => {
    const hotbar = [...s.hotbar];
    const sl = hotbar[slot];
    if (!sl || sl.id === 0) return {};
    const newCount = sl.count - count;
    hotbar[slot] = newCount <= 0 ? { id: 0, count: 0 } : { id: sl.id, count: newCount };
    return { hotbar };
  }),
  setHotbar: slots => set({ hotbar: slots }),
  setStats: (fps, posStr, mode) => set({ fps, posStr, mode }),
}));
