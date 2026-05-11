import { create } from 'zustand';

interface ChestStore {
  pos: [number, number, number] | null;
  slots: number[];
  setData: (pos: [number, number, number], slots: number[]) => void;
  close: () => void;
  setSlot: (idx: number, blockId: number) => void;
}

export const useChestStore = create<ChestStore>((set) => ({
  pos: null,
  slots: Array(27).fill(0),
  setData: (pos, slots) => {
    const s = Array(27).fill(0);
    for (let i = 0; i < Math.min(slots.length, 27); i++) s[i] = slots[i];
    set({ pos, slots: s });
  },
  close: () => set({ pos: null }),
  setSlot: (idx, blockId) => set(s => {
    const slots = [...s.slots];
    slots[idx] = blockId;
    return { slots };
  }),
}));
