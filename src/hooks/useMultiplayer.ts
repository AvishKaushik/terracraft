import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useMultiplayerStore, type RemotePlayer } from '../stores/multiplayerStore';
import { useWorldStore, type BlockChange } from '../stores/worldStore';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { usePlayerStore } from '../stores/playerStore';
import { useChestStore } from '../stores/chestStore';
import { pushSnapshot, removeBuffer } from '../lib/interpolation';

export function useMultiplayer() {
  useEffect(() => {
    const { setConnected, upsertPlayer, removePlayer } = useMultiplayerStore.getState();
    const { applyWorldChanges, setBlockSilent } = useWorldStore.getState();
    const { token, serverCode } = useAuthStore.getState();

    // Reset world ready flag for this session
    useGameStore.getState().setWorldReady(false);

    socket.connect();

    socket.on('connect',    () => setConnected(true));
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

    // ── Admin command responses ──────────────────────────────
    socket.on('cmd:tp', ({ pos }: { pos: [number, number, number] }) => {
      usePlayerStore.getState().setPos(pos);
    });

    socket.on('cmd:give', ({ blockId }: { blockId: number }) => {
      const gs = useGameStore.getState();
      gs.setHotbarSlot(gs.currentSlot, blockId);
    });

    // ── Chest events ──────────────────────────────────────────
    socket.on('chest:data', ({ pos, slots }: { pos: [number,number,number]; slots: number[] }) => {
      useChestStore.getState().setData(pos, slots);
    });

    socket.on('chest:set', ({ idx, blockId }: { idx: number; blockId: number }) => {
      useChestStore.getState().setSlot(idx, blockId);
    });

    socket.emit('player:join', { token, serverCode });

    return () => {
      socket.off('connect'); socket.off('disconnect');
      socket.off('world:changes'); socket.off('players:snapshot');
      socket.off('player:joined'); socket.off('player:moved'); socket.off('player:left');
      socket.off('block:set'); socket.off('cmd:tp'); socket.off('cmd:give');
      socket.off('chest:data'); socket.off('chest:set');
      socket.disconnect();
    };
  }, []);
}
