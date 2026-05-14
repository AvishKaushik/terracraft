import { create } from 'zustand';

export interface DroppedCluster {
  id: number;
  pos: [number, number, number];
  items: { id: number; count: number }[];
}

interface DroppedItemsStore {
  clusters: Map<number, DroppedCluster>;
  clusterIds: number[];
  addCluster: (c: DroppedCluster) => void;
  removeCluster: (id: number) => void;
  clear: () => void;
}

export const useDroppedItemsStore = create<DroppedItemsStore>(set => ({
  clusters: new Map(),
  clusterIds: [],
  addCluster: (c) => set(s => {
    const clusters = new Map(s.clusters);
    clusters.set(c.id, c);
    return { clusters, clusterIds: [...clusters.keys()] };
  }),
  removeCluster: (id) => set(s => {
    const clusters = new Map(s.clusters);
    clusters.delete(id);
    return { clusters, clusterIds: [...clusters.keys()] };
  }),
  clear: () => set({ clusters: new Map(), clusterIds: [] }),
}));
