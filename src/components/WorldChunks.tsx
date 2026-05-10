import type { ReactElement } from 'react';
import { CHUNKS_X, CHUNKS_Z } from '../lib/constants';
import { ChunkMesh } from './ChunkMesh';

export function WorldChunks() {
  const chunks: ReactElement[] = [];
  for (let cz = 0; cz < CHUNKS_Z; cz++) {
    for (let cx = 0; cx < CHUNKS_X; cx++) {
      chunks.push(<ChunkMesh key={`${cx},${cz}`} cx={cx} cz={cz} />);
    }
  }
  return <>{chunks}</>;
}
