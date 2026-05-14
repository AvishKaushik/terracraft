import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { CHUNKS_X, CHUNKS_Z, CHUNK_SIZE } from '../lib/constants';
import { ChunkMesh } from './ChunkMesh';
import { usePlayerStore } from '../stores/playerStore';

const VIEW_DIST = 7; // chunks (7×16 = 112 blocks)

export function WorldChunks() {
  const pcx = usePlayerStore(s => Math.floor(s.pos[0] / CHUNK_SIZE));
  const pcz = usePlayerStore(s => Math.floor(s.pos[2] / CHUNK_SIZE));

  const chunks = useMemo(() => {
    const result: ReactElement[] = [];
    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        if (Math.abs(cx - pcx) > VIEW_DIST || Math.abs(cz - pcz) > VIEW_DIST) continue;
        result.push(<ChunkMesh key={`${cx},${cz}`} cx={cx} cz={cz} />);
      }
    }
    return result;
  }, [pcx, pcz]);

  return <>{chunks}</>;
}
