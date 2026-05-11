/// <reference lib="webworker" />
import { buildChunkRaw, type RawMesh } from '../lib/mesher';

interface BuildRequest {
  id: number;
  cx: number;
  cz: number;
  world: Uint8Array;
  skyLightMap: Uint8Array;
  blockLightMap: Uint8Array;
}

self.onmessage = ({ data }: MessageEvent<BuildRequest>) => {
  const { id, cx, cz, world, skyLightMap, blockLightMap } = data;
  const { opaque, trans } = buildChunkRaw(cx, cz, world, skyLightMap, blockLightMap);

  const transferables: ArrayBuffer[] = [];

  const pack = (raw: RawMesh | null) => {
    if (!raw) return null;
    transferables.push(
      raw.positions.buffer as ArrayBuffer,
      raw.normals.buffer   as ArrayBuffer,
      raw.uvs.buffer       as ArrayBuffer,
      raw.colors.buffer    as ArrayBuffer,
      raw.skyLights.buffer as ArrayBuffer,
      raw.waterTops.buffer as ArrayBuffer,
      raw.indices.buffer   as ArrayBuffer,
    );
    return raw;
  };

  (self as DedicatedWorkerGlobalScope).postMessage(
    { id, opaque: pack(opaque), trans: pack(trans) },
    { transfer: transferables },
  );
};
