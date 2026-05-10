import { create } from 'zustand';

export interface RemotePlayer {
  id: string;
  name: string;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  skinColor:  string;
  shirtColor: string;
  pantsColor: string;
}

interface MultiplayerStore {
  connected: boolean;
  players: Map<string, RemotePlayer>;
  playerIds: string[];
  setConnected: (v: boolean) => void;
  upsertPlayer: (p: RemotePlayer) => void;
  removePlayer: (id: string) => void;
}

export const useMultiplayerStore = create<MultiplayerStore>(set => ({
  connected: false,
  players: new Map(),
  playerIds: [],
  setConnected: connected => set({ connected }),
  upsertPlayer: p => set(s => {
    const m = new Map(s.players);
    m.set(p.id, p);
    const ids = s.playerIds.includes(p.id) ? s.playerIds : [...s.playerIds, p.id];
    return { players: m, playerIds: ids };
  }),
  removePlayer: id => set(s => {
    const m = new Map(s.players);
    m.delete(id);
    return { players: m, playerIds: s.playerIds.filter(i => i !== id) };
  }),
}));
