import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { VILLAGE_SEEDS } from '../lib/terrain';

export type QuestCategory = 'tutorial' | 'gathering' | 'combat' | 'exploration';

export interface Quest {
  id: string;
  title: string;
  desc: string;
  category: QuestCategory;
  progress: number;
  goal: number;
  complete: boolean;
  rewardXp: number;
  rewardItems?: { id: number; count: number }[];
}

const INITIAL_QUESTS: Quest[] = [
  // Tutorial
  { id: 'first_steps',   title: 'First Steps',      desc: 'Travel 50 blocks from spawn',       category: 'tutorial',     progress: 0, goal: 50,  complete: false, rewardXp: 20 },
  { id: 'builder',       title: 'Builder',           desc: 'Place 20 blocks',                   category: 'tutorial',     progress: 0, goal: 20,  complete: false, rewardXp: 20 },
  // Gathering
  { id: 'lumberjack',    title: 'Lumberjack',        desc: 'Chop 10 tree logs',                 category: 'gathering',    progress: 0, goal: 10,  complete: false, rewardXp: 25 },
  { id: 'quarryman',     title: 'Quarryman',         desc: 'Mine 20 stone blocks',              category: 'gathering',    progress: 0, goal: 20,  complete: false, rewardXp: 25 },
  { id: 'prospector',    title: 'Iron Prospector',   desc: 'Mine 5 iron ore',                   category: 'gathering',    progress: 0, goal: 5,   complete: false, rewardXp: 50 },
  { id: 'diamond',       title: 'Diamond Hunter',    desc: 'Mine 1 diamond ore',                category: 'gathering',    progress: 0, goal: 1,   complete: false, rewardXp: 100 },
  { id: 'harvest',       title: 'Harvest Time',      desc: 'Harvest 5 ripe wheat',              category: 'gathering',    progress: 0, goal: 5,   complete: false, rewardXp: 30, rewardItems: [{ id: 283, count: 5 }] },
  // Combat
  { id: 'monster_hunter',title: 'Monster Hunter',    desc: 'Kill 5 hostile mobs',               category: 'combat',       progress: 0, goal: 5,   complete: false, rewardXp: 50 },
  { id: 'zombie_slayer', title: 'Zombie Slayer',     desc: 'Kill 5 zombies',                    category: 'combat',       progress: 0, goal: 5,   complete: false, rewardXp: 40, rewardItems: [{ id: 281, count: 10 }] },
  { id: 'undead_archer', title: 'Undead Archer',     desc: 'Kill 3 skeletons',                  category: 'combat',       progress: 0, goal: 3,   complete: false, rewardXp: 60, rewardItems: [{ id: 280, count: 1 }] },
  { id: 'spider_killer', title: 'Exterminator',      desc: 'Kill 5 spiders',                    category: 'combat',       progress: 0, goal: 5,   complete: false, rewardXp: 45, rewardItems: [{ id: 278, count: 5 }] },
  // Exploration
  { id: 'wanderer',      title: 'Wanderer',          desc: 'Travel 200 blocks from spawn',      category: 'exploration',  progress: 0, goal: 200, complete: false, rewardXp: 50 },
  { id: 'cave_explorer', title: 'Cave Explorer',     desc: 'Descend below Y = 8',               category: 'exploration',  progress: 0, goal: 1,   complete: false, rewardXp: 40 },
  { id: 'village_found', title: 'Village Found',     desc: 'Discover a village',                category: 'exploration',  progress: 0, goal: 1,   complete: false, rewardXp: 60, rewardItems: [{ id: 4, count: 16 }] },
  { id: 'great_explorer',title: 'Great Explorer',    desc: 'Travel 500 blocks from spawn',      category: 'exploration',  progress: 0, goal: 500, complete: false, rewardXp: 100, rewardItems: [{ id: 31, count: 1 }] },
];

interface QuestStore {
  quests: Quest[];
  panelOpen: boolean;
  lastCompleted: string | null;
  setPanelOpen: (v: boolean) => void;
  reportBreak: (blockId: number) => void;
  reportKill: (mobType: string) => void;
  reportPlace: () => void;
  reportPos: (x: number, y: number, z: number, spawnX: number, spawnZ: number) => void;
  claimCompleted: () => void;
}

export const useQuestStore = create<QuestStore>()(persist((set) => ({
  quests: INITIAL_QUESTS,
  panelOpen: false,
  lastCompleted: null,

  setPanelOpen: (v) => set({ panelOpen: v }),
  claimCompleted: () => set({ lastCompleted: null }),

  reportBreak: (blockId) => {
    set(s => {
      const quests = s.quests.map(q => {
        if (q.complete) return q;
        let hit = false;
        if (q.id === 'lumberjack'  && blockId === 6)  hit = true;
        if (q.id === 'quarryman'   && (blockId === 3 || blockId === 4)) hit = true;
        if (q.id === 'prospector'  && blockId === 29) hit = true;
        if (q.id === 'diamond'     && blockId === 31) hit = true;
        if (q.id === 'harvest'     && blockId === 42) hit = true;
        if (!hit) return q;
        const progress = Math.min(q.goal, q.progress + 1);
        return { ...q, progress, complete: progress >= q.goal };
      });
      const newly = quests.find((q, i) => q.complete && !s.quests[i].complete);
      return { quests, lastCompleted: newly?.title ?? s.lastCompleted };
    });
  },

  reportKill: (mobType) => {
    set(s => {
      const hostile = ['zombie', 'skeleton', 'creeper', 'spider', 'slime'];
      const quests = s.quests.map(q => {
        if (q.complete) return q;
        let hit = false;
        if (q.id === 'monster_hunter' && hostile.includes(mobType)) hit = true;
        if (q.id === 'zombie_slayer'  && mobType === 'zombie')   hit = true;
        if (q.id === 'undead_archer'  && mobType === 'skeleton') hit = true;
        if (q.id === 'spider_killer'  && mobType === 'spider')   hit = true;
        if (!hit) return q;
        const progress = Math.min(q.goal, q.progress + 1);
        return { ...q, progress, complete: progress >= q.goal };
      });
      const newly = quests.find((q, i) => q.complete && !s.quests[i].complete);
      return { quests, lastCompleted: newly?.title ?? s.lastCompleted };
    });
  },

  reportPlace: () => {
    set(s => {
      const quests = s.quests.map(q => {
        if (q.complete || q.id !== 'builder') return q;
        const progress = Math.min(q.goal, q.progress + 1);
        return { ...q, progress, complete: progress >= q.goal };
      });
      const newly = quests.find((q, i) => q.complete && !s.quests[i].complete);
      return { quests, lastCompleted: newly?.title ?? s.lastCompleted };
    });
  },

  reportPos: (x, y, z, spawnX, spawnZ) => {
    const dx = x - spawnX, dz = z - spawnZ;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const nearVillage = VILLAGE_SEEDS.some(v =>
      Math.abs(x - (v.vx + 3)) < 20 && Math.abs(z - (v.vz + 3)) < 20,
    );
    set(s => {
      const quests = s.quests.map(q => {
        if (q.complete) return q;
        if (q.id === 'first_steps'   && dist >= 50)  return { ...q, progress: q.goal, complete: true };
        if (q.id === 'wanderer'      && dist >= 200) return { ...q, progress: q.goal, complete: true };
        if (q.id === 'great_explorer'&& dist >= 500) return { ...q, progress: q.goal, complete: true };
        if (q.id === 'cave_explorer' && y < 8)       return { ...q, progress: q.goal, complete: true };
        if (q.id === 'village_found' && nearVillage) return { ...q, progress: q.goal, complete: true };
        return q;
      });
      const newly = quests.find((q, i) => q.complete && !s.quests[i].complete);
      return { quests, lastCompleted: newly?.title ?? s.lastCompleted };
    });
  },
}), {
  name: 'quest-progress',
  // Only persist quest state (progress + completion), not transient UI/reward flags
  partialize: (s) => ({ quests: s.quests.map(q => ({ id: q.id, progress: q.progress, complete: q.complete })) }),
  merge: (persisted, current) => {
    const saved = (persisted as { quests: { id: string; progress: number; complete: boolean }[] }).quests ?? [];
    const savedMap = new Map(saved.map(q => [q.id, q]));
    return {
      ...current,
      quests: current.quests.map(q => {
        const s = savedMap.get(q.id);
        return s ? { ...q, progress: s.progress, complete: s.complete } : q;
      }),
    };
  },
}));
