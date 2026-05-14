import { create } from 'zustand';

export interface KillEntry {
  id: number;
  text: string;
  own: boolean; // true = player made this kill
}

let _nextId = 0;

interface KillFeedStore {
  entries: KillEntry[];
  push: (text: string, own: boolean) => void;
  remove: (id: number) => void;
}

export const useKillFeedStore = create<KillFeedStore>(set => ({
  entries: [],
  push: (text, own) => set(s => ({
    entries: [...s.entries.slice(-4), { id: ++_nextId, text, own }],
  })),
  remove: (id) => set(s => ({ entries: s.entries.filter(e => e.id !== id) })),
}));
