import { useEffect, useRef } from 'react';
import { useWorldStore } from '../stores/worldStore';
import { usePlayerStore } from '../stores/playerStore';
import { useMultiplayerStore } from '../stores/multiplayerStore';
import { mobTargets, useMobStore } from '../stores/mobStore';
import { getInterpolated } from '../lib/interpolation';
import { WORLD_W, WORLD_D, WORLD_H } from '../lib/constants';

const MAP_SIZE = 128;
const SCALE = MAP_SIZE / WORLD_W; // 2px per block (64 world → 128 canvas)

// Approximate top-down colors per block ID
const BLOCK_RGB: Record<number, [number, number, number]> = {
  1:  [90,  138, 60 ], // grass
  2:  [122, 92,  58 ], // dirt
  3:  [128, 128, 128], // stone
  4:  [102, 102, 102], // cobblestone
  5:  [224, 208, 128], // sand
  6:  [90,  58,  26 ], // oak log
  7:  [200, 160, 96 ], // oak planks
  8:  [58,  122, 42 ], // leaves
  9:  [160, 64,  64 ], // bricks
  10: [128, 192, 224], // glass
  11: [144, 144, 144], // stone bricks
  12: [232, 232, 240], // snow
  13: [160, 144, 128], // gravel
  14: [32,  0,   32 ], // obsidian
  15: [255, 204, 0  ], // torch
  16: [255, 255, 160], // glowstone
  17: [32,  96,  192], // water
  18: [208, 192, 128], // sandstone
  19: [216, 216, 216], // iron block
  20: [255, 215, 0  ], // gold block
  21: [64,  224, 208], // diamond block
  22: [204, 51,  51 ], // red wool
  23: [240, 240, 240], // white wool
  24: [112, 120, 80 ], // mossy cobblestone
  25: [139, 69,  19 ], // bookshelf
  26: [139, 48,  48 ], // netherrack
  27: [200, 200, 32 ], // sponge
  28: [64,  64,  64 ], // coal ore
  29: [144, 144, 128], // iron ore
  30: [192, 144, 64 ], // gold ore
  31: [80,  192, 208], // diamond ore
  32: [160, 96,  32 ], // chest
  33: [180, 60,  60 ], // bed
};

function blockRGB(id: number, y: number): [number, number, number] {
  const base = BLOCK_RGB[id] ?? [128, 128, 128];
  const shade = Math.max(0.45, Math.min(1.0, y / 18));
  return [
    Math.floor(base[0] * shade),
    Math.floor(base[1] * shade),
    Math.floor(base[2] * shade),
  ];
}

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDraw  = useRef(0);

  useEffect(() => {
    let raf: number;

    function draw() {
      raf = requestAnimationFrame(draw);
      const now = performance.now();
      if (now - lastDraw.current < 200) return; // 5 Hz
      lastDraw.current = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { world } = useWorldStore.getState();
      const { pos, yaw } = usePlayerStore.getState();
      const { playerIds } = useMultiplayerStore.getState();
      const { mobIds, mobs } = useMobStore.getState();

      // ── World pixels ────────────────────────────────────────
      const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
      const d   = img.data;

      for (let wx = 0; wx < WORLD_W; wx++) {
        for (let wz = 0; wz < WORLD_D; wz++) {
          let topId = 0, topY = 0;
          for (let wy = WORLD_H - 1; wy >= 0; wy--) {
            const b = world[(wy * WORLD_D + wz) * WORLD_W + wx];
            if (b !== 0 && b !== 17) { topId = b; topY = wy; break; }
          }
          if (topId === 0) continue;

          const [r, g, b2] = blockRGB(topId, topY);
          const px0 = Math.floor(wx * SCALE);
          const pz0 = Math.floor(wz * SCALE);
          for (let dy = 0; dy < SCALE; dy++) {
            for (let dx = 0; dx < SCALE; dx++) {
              const i = ((pz0 + dy) * MAP_SIZE + (px0 + dx)) * 4;
              d[i] = r; d[i + 1] = g; d[i + 2] = b2; d[i + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(img, 0, 0);

      // ── Mobs ────────────────────────────────────────────────
      for (const id of mobIds) {
        const t   = mobTargets.get(id);
        const mob = mobs.get(id);
        if (!t || !mob) continue;
        const mx = t.pos[0] * SCALE;
        const mz = t.pos[2] * SCALE;
        ctx.fillStyle = mob.type === 'zombie' ? '#44dd44' : '#8b5c1a';
        ctx.fillRect(Math.floor(mx) - 1, Math.floor(mz) - 1, 3, 3);
      }

      // ── Other players ───────────────────────────────────────
      for (const id of playerIds) {
        const interp = getInterpolated(id);
        if (!interp) continue;
        const px = interp.pos.x * SCALE;
        const pz = interp.pos.z * SCALE;
        ctx.fillStyle = '#ffee22';
        ctx.fillRect(Math.floor(px) - 1, Math.floor(pz) - 1, 3, 3);
      }

      // ── Local player arrow ──────────────────────────────────
      const ppx = pos[0] * SCALE;
      const ppz = pos[2] * SCALE;
      ctx.save();
      ctx.translate(ppx, ppz);
      ctx.rotate(yaw); // yaw=0 faces -Z = up in map; rotate matches world orientation
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.lineTo(-3, 3.5);
      ctx.lineTo(3, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={MAP_SIZE} height={MAP_SIZE} id="minimap" />;
}
