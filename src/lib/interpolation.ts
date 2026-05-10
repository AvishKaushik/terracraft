import * as THREE from 'three';

interface Snapshot {
  pos: [number, number, number];
  yaw: number;
  pitch: number;
  t: number;
}

// Module-level buffers — rendering state, not React state (no re-renders)
const buffers = new Map<string, Snapshot[]>();

const BUFFER_SIZE  = 20;
const RENDER_DELAY = 100; // ms behind real-time — guarantees 2 snapshots at 20 Hz

export function pushSnapshot(id: string, pos: [number, number, number], yaw: number, pitch: number) {
  if (!buffers.has(id)) buffers.set(id, []);
  const buf = buffers.get(id)!;
  buf.push({ pos, yaw, pitch, t: performance.now() });
  if (buf.length > BUFFER_SIZE) buf.shift();
}

export function removeBuffer(id: string) {
  buffers.delete(id);
}

export function getInterpolated(id: string): { pos: THREE.Vector3; yaw: number; pitch: number } | null {
  const buf = buffers.get(id);
  if (!buf || buf.length === 0) return null;

  const renderTime = performance.now() - RENDER_DELAY;

  if (buf.length === 1 || renderTime <= buf[0].t) {
    return { pos: new THREE.Vector3(...buf[0].pos), yaw: buf[0].yaw, pitch: buf[0].pitch };
  }

  if (renderTime >= buf[buf.length - 1].t) {
    const last = buf[buf.length - 1];
    return { pos: new THREE.Vector3(...last.pos), yaw: last.yaw, pitch: last.pitch };
  }

  let i = buf.length - 2;
  while (i > 0 && buf[i].t > renderTime) i--;

  const a = buf[i], b = buf[i + 1];
  const alpha = (renderTime - a.t) / (b.t - a.t);

  const pos = new THREE.Vector3(...a.pos).lerp(new THREE.Vector3(...b.pos), alpha);

  let yawDelta = b.yaw - a.yaw;
  if (yawDelta >  Math.PI) yawDelta -= 2 * Math.PI;
  if (yawDelta < -Math.PI) yawDelta += 2 * Math.PI;

  return {
    pos,
    yaw:   a.yaw   + yawDelta           * alpha,
    pitch: a.pitch + (b.pitch - a.pitch) * alpha,
  };
}
