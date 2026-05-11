import type { RawMesh } from './mesher';

export interface ChunkResult {
  opaque: RawMesh | null;
  trans:  RawMesh | null;
}

interface PendingJob {
  resolve: (r: ChunkResult) => void;
}

interface PoolWorker {
  worker: Worker;
  busy:   boolean;
}

interface QueuedJob {
  id:            number;
  cx:            number;
  cz:            number;
  world:         Uint8Array;
  skyLightMap:   Uint8Array;
  blockLightMap: Uint8Array;
  resolve:       (r: ChunkResult) => void;
}

const POOL_SIZE = Math.min(Math.max((navigator.hardwareConcurrency ?? 2) - 1, 1), 4);

let nextId = 0;
const pending = new Map<number, PendingJob>();
const queue:   QueuedJob[] = [];

const pool: PoolWorker[] = Array.from({ length: POOL_SIZE }, () => {
  const worker = new Worker(
    new URL('../workers/mesher.worker.ts', import.meta.url),
    { type: 'module' },
  );
  const pw: PoolWorker = { worker, busy: false };

  worker.onmessage = ({ data }: MessageEvent<{ id: number } & ChunkResult>) => {
    const { id, opaque, trans } = data;
    pw.busy = false;
    pending.get(id)?.resolve({ opaque, trans });
    pending.delete(id);
    dispatch();
  };

  return pw;
});

function dispatch() {
  if (queue.length === 0) return;
  const pw = pool.find(p => !p.busy);
  if (!pw) return;

  const job = queue.shift()!;
  pw.busy = true;
  pending.set(job.id, { resolve: job.resolve });

  // Copy arrays so the originals remain accessible on the main thread
  const world        = job.world.slice();
  const skyLightMap  = job.skyLightMap.slice();
  const blockLightMap = job.blockLightMap.slice();

  pw.worker.postMessage(
    { id: job.id, cx: job.cx, cz: job.cz, world, skyLightMap, blockLightMap },
    { transfer: [world.buffer, skyLightMap.buffer, blockLightMap.buffer] },
  );
}

export function buildChunkAsync(
  cx: number,
  cz: number,
  world: Uint8Array,
  skyLightMap: Uint8Array,
  blockLightMap: Uint8Array,
): Promise<ChunkResult> {
  return new Promise(resolve => {
    queue.push({ id: nextId++, cx, cz, world, skyLightMap, blockLightMap, resolve });
    dispatch();
  });
}
