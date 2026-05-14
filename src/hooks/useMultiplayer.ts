import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useMultiplayerStore, type RemotePlayer } from '../stores/multiplayerStore';
import { useWorldStore, type BlockChange } from '../stores/worldStore';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { useChestStore } from '../stores/chestStore';
import { useMobStore, mobTargets, mobFusing, type MobData } from '../stores/mobStore';
import { getMobDrop } from '../lib/drops';
import { ITEMS } from '../lib/items';
import { useKillFeedStore } from '../stores/killFeedStore';
import { useDroppedItemsStore, type DroppedCluster } from '../stores/droppedItemsStore';
import { useXpStore } from '../stores/xpStore';
import { pushSnapshot, removeBuffer } from '../lib/interpolation';
import { serverTime } from '../lib/serverTime';
import { weatherState, type WeatherType } from '../lib/weather';
import { addArrow } from '../lib/arrows';
import { useQuestStore } from '../stores/questStore';

export function useMultiplayer() {
  useEffect(() => {
    const { setConnected, upsertPlayer, removePlayer } = useMultiplayerStore.getState();
    const { applyWorldChanges, applyExplosion, setBlockSilent } = useWorldStore.getState();
    const { token, serverCode } = useAuthStore.getState();
    const { setHotbar } = useGameStore.getState();

    // Reset world ready flag for this session
    useGameStore.getState().setWorldReady(false);

    // Reset server time so SceneSetup doesn't keep stale sync from a previous session
    serverTime.elapsed = -1;
    serverTime.synced  = false;

    socket.connect();

    socket.on('connect', () => {
      setConnected(true);
      // Re-emit player:join on every connection (initial + reconnects after network drops).
      // Without this, a reconnected socket is not in the server room and misses all events.
      socket.emit('player:join', { token, serverCode });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('world:changes', (changes: BlockChange[]) => {
      applyWorldChanges(changes);
      useGameStore.getState().setWorldReady(true);
    });

    socket.on('players:snapshot', (list: RemotePlayer[]) => {
      list.forEach(p => {
        upsertPlayer(p);
        pushSnapshot(p.id, p.pos, p.yaw, p.pitch);
      });
    });

    socket.on('player:joined', (p: RemotePlayer) => {
      upsertPlayer(p);
      pushSnapshot(p.id, p.pos, p.yaw, p.pitch);
    });

    // player:moved feeds the interpolation buffer — does NOT update React store
    socket.on('player:moved', ({ id, pos, yaw, pitch }: RemotePlayer) => {
      pushSnapshot(id, pos, yaw, pitch);
    });

    socket.on('player:left', (id: string) => {
      removePlayer(id);
      removeBuffer(id);
    });

    socket.on('block:set', ({ x, y, z, id, face }: {
      x: number; y: number; z: number; id: number;
      face?: [number, number, number];
    }) => {
      setBlockSilent(x, y, z, id, face);
    });

    socket.on('tnt:explode', ({ x, y, z, changes }: { x: number; y: number; z: number; changes: Array<{ x: number; y: number; z: number; id: number }> }) => {
      applyExplosion(changes, x, y, z);
    });

    // Load saved inventory when joining
    socket.on('inventory:load', ({ slots }: { slots: Array<{ id: number; count: number; enchants?: Record<string, number> }> }) => {
      const empty = Array(9).fill(null).map(() => ({ id: 0, count: 0 }));
      slots.forEach((s, i) => { if (i < 9) empty[i] = s; });
      setHotbar(empty);
    });

    // Save hotbar to server whenever it changes (debounced to avoid hammering DB)
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let prevHotbar = useGameStore.getState().hotbar;
    const unsubHotbar = useGameStore.subscribe(state => {
      if (state.hotbar === prevHotbar) return;
      prevHotbar = state.hotbar;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveTimer = null;
        socket.emit('inventory:save', { slots: useGameStore.getState().hotbar });
      }, 500);
    });

    // ── Admin command responses ──────────────────────────────
    socket.on('cmd:tp', ({ pos }: { pos: [number, number, number] }) => {
      usePlayerStore.getState().setPos(pos);
    });

    socket.on('cmd:give', ({ blockId }: { blockId: number }) => {
      const gs = useGameStore.getState();
      gs.setHotbarSlot(gs.currentSlot, blockId);
    });

    // ── Mob events ────────────────────────────────────────────
    socket.on('mobs:snapshot', (list: MobData[]) => {
      const { upsertMob, clearMobs } = useMobStore.getState();
      clearMobs();
      mobTargets.clear();
      for (const mob of list) {
        upsertMob(mob);
        mobTargets.set(mob.id, { pos: mob.pos, yaw: mob.yaw });
      }
    });

    socket.on('mobs:moved', (updates: { id: string; pos: [number,number,number]; yaw: number }[]) => {
      for (const u of updates) mobTargets.set(u.id, { pos: u.pos, yaw: u.yaw });
    });

    socket.on('mob:damaged', ({ id, health }: { id: string; health: number }) => {
      useMobStore.getState().updateMobHealth(id, health);
    });

    socket.on('mob:died', ({ id, killerId }: { id: string; killerId: string | null }) => {
      const mob = useMobStore.getState().mobs.get(id);
      if (mob) {
        if (killerId && killerId === socket.id) {
          const drop = getMobDrop(mob.type);
          if (drop) useGameStore.getState().addToHotbar(drop.id, drop.count);
          useKillFeedStore.getState().push(`You killed a ${mob.type}`, true);
          useQuestStore.getState().reportKill(mob.type);
        }
        mobFusing.delete(id);
      }
      useMobStore.getState().removeMob(id);
      mobTargets.delete(id);
    });

    socket.on('xp:gained', ({ amount }: { amount: number }) => {
      useXpStore.getState().addXp(amount);
    });

    socket.on('mob:fuse', ({ id, fusing }: { id: string; fusing: boolean }) => {
      if (fusing) mobFusing.add(id); else mobFusing.delete(id);
    });

    socket.on('arrow:fired', (data: { id: string; from: number[]; to: number[]; duration: number }) => {
      addArrow(data);
    });

    socket.on('time:sync', ({ elapsed }: { elapsed: number }) => {
      serverTime.elapsed = elapsed;
      serverTime.synced = false; // let SceneSetup re-sync on next frame
    });

    socket.on('weather:change', ({ type }: { type: WeatherType }) => {
      weatherState.type = type;
    });

    socket.on('player:damaged', ({ amount, attackerId }: { amount: number; attackerId?: string }) => {
      const ps = usePlayerStore.getState();
      const gs = useGameStore.getState();
      const totalDef = (['head', 'chest', 'legs', 'feet'] as const).reduce((sum, slot) => {
        return sum + (ITEMS[ps.armor[slot]]?.armorValue ?? 0);
      }, 0);
      // Protection enchant: sum Protection levels across all armor slots
      const protBonus = (['head', 'chest', 'legs', 'feet'] as const).reduce((sum, _slot) => {
        // check hotbar for equipped armor enchants (simplified: check all slots)
        const prot = gs.hotbar.reduce((s, sl) => s + (sl?.enchants?.Protection ?? 0), 0);
        return sum + prot;
      }, 0) / 4; // average across 4 checks — simplified
      const defFrac = Math.min(0.85, (totalDef + protBonus * 2) / 25);
      const reduced = Math.max(1, Math.round(amount * (1 - defFrac)));
      const newHp = Math.max(0, ps.health - reduced);
      ps.setHealth(newHp);
      const el = document.getElementById('damage-flash');
      if (el) { el.classList.add('active'); setTimeout(() => el.classList.remove('active'), 350); }
      if (newHp <= 0) {
        ps.setDead(true);
        // Drop all hotbar items on death
        const gs = useGameStore.getState();
        const drops = gs.hotbar
          .filter(s => s && s.id !== 0)
          .map(s => ({ id: s!.id, count: s!.count }));
        socket.emit('player:died', { killerId: attackerId ?? null, items: drops });
        for (let i = 0; i < 9; i++) gs.setHotbarSlot(i, 0);
      }
    });

    socket.on('killfeed:pvp', ({ killerName, victimName }: { killerName: string; victimName: string }) => {
      const myName = useAuthStore.getState().username ?? '';
      const own = killerName === myName;
      useKillFeedStore.getState().push(`${killerName} killed ${victimName}`, own);
    });

    socket.on('items:dropped', (cluster: DroppedCluster) => {
      useDroppedItemsStore.getState().addCluster(cluster);
    });

    socket.on('items:removed', ({ id }: { id: number }) => {
      useDroppedItemsStore.getState().removeCluster(id);
    });

    socket.on('items:give', (items: { id: number; count: number }[]) => {
      const gs = useGameStore.getState();
      for (const it of items) gs.addToHotbar(it.id, it.count);
      useDroppedItemsStore.getState(); // no-op, pickup already handled by items:removed
    });

    // ── Chest events ──────────────────────────────────────────
    socket.on('chest:data', ({ pos, slots }: { pos: [number,number,number]; slots: number[] }) => {
      useChestStore.getState().setData(pos, slots);
    });

    socket.on('chest:set', ({ idx, blockId }: { idx: number; blockId: number }) => {
      useChestStore.getState().setSlot(idx, blockId);
    });

    return () => {
      socket.off('connect'); socket.off('disconnect');
      socket.off('world:changes'); socket.off('players:snapshot');
      socket.off('player:joined'); socket.off('player:moved'); socket.off('player:left');
      socket.off('block:set'); socket.off('tnt:explode'); socket.off('inventory:load');
      socket.off('cmd:tp'); socket.off('cmd:give');
      unsubHotbar();
      if (saveTimer) clearTimeout(saveTimer);
      // Flush inventory immediately before disconnect so no changes are lost
      socket.emit('inventory:save', { slots: useGameStore.getState().hotbar });
      socket.off('mobs:snapshot'); socket.off('mobs:moved');
      socket.off('mob:damaged'); socket.off('mob:died'); socket.off('mob:fuse');
      socket.off('arrow:fired'); socket.off('time:sync'); socket.off('player:damaged');
      socket.off('weather:change');
      socket.off('killfeed:pvp');
      socket.off('items:dropped'); socket.off('items:removed'); socket.off('items:give');
      socket.off('xp:gained');
      socket.off('chest:data'); socket.off('chest:set');
      socket.disconnect();
    };
  }, []);
}
