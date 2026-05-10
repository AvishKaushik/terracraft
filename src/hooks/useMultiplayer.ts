import { useEffect } from 'react';
import { socket } from '../lib/socket';
import { useMultiplayerStore, type RemotePlayer } from '../stores/multiplayerStore';
import { useWorldStore } from '../stores/worldStore';
import { useAuthStore } from '../stores/authStore';
import { pushSnapshot, removeBuffer } from '../lib/interpolation';

export function useMultiplayer() {
  useEffect(() => {
    const { setConnected, upsertPlayer, removePlayer } = useMultiplayerStore.getState();
    const { setBlockSilent } = useWorldStore.getState();
    const { token, serverCode } = useAuthStore.getState();

    socket.connect();

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('world:changes', (changes: { x: number; y: number; z: number; id: number; face?: [number,number,number] }[]) => {
      changes.forEach(({ x, y, z, id, face }) => setBlockSilent(x, y, z, id, face));
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

    socket.emit('player:join', { token, serverCode });

    return () => {
      socket.off('connect'); socket.off('disconnect');
      socket.off('world:changes'); socket.off('players:snapshot');
      socket.off('player:joined'); socket.off('player:moved'); socket.off('player:left');
      socket.off('block:set');
      socket.disconnect();
    };
  }, []);
}
