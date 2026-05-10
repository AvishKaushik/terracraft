import * as THREE from 'three';
import { TEX_SIZE, ATLAS_COLS, ATLAS_ROWS } from './constants';

function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 1000) / 1000;
  };
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function noisy(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  base: [number, number, number],
  range: number,
  seed: number
) {
  const r = rng(seed);
  for (let i = 0; i < TEX_SIZE; i++) {
    for (let j = 0; j < TEX_SIZE; j++) {
      const v = (r() - 0.5) * range;
      const cr = Math.max(0, Math.min(255, base[0] + v));
      const cg = Math.max(0, Math.min(255, base[1] + v));
      const cb = Math.max(0, Math.min(255, base[2] + v));
      px(ctx, ox + i, oy + j, `rgb(${cr | 0},${cg | 0},${cb | 0})`);
    }
  }
}

export function buildAtlas(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE * ATLAS_COLS;
  canvas.height = TEX_SIZE * ATLAS_ROWS;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  function fill(idx: number, drawer: (ctx: CanvasRenderingContext2D, x: number, y: number) => void) {
    const col = idx % ATLAS_COLS;
    const row = Math.floor(idx / ATLAS_COLS);
    drawer(ctx, col * TEX_SIZE, row * TEX_SIZE);
  }

  // 0 grass top
  fill(0, (ctx, x, y) => {
    noisy(ctx, x, y, [88, 134, 60], 28, 11);
    const r = rng(22);
    for (let k = 0; k < 14; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#3e6222');
  });
  // 1 grass side
  fill(1, (ctx, x, y) => {
    noisy(ctx, x, y, [110, 78, 54], 20, 33);
    const r = rng(44);
    for (let i = 0; i < 16; i++) {
      const h = 2 + ((r() * 3) | 0);
      for (let j = 0; j < h; j++) {
        const g = 80 + ((r() * 34) | 0);
        px(ctx, x + i, y + j, `rgb(${(g * 0.7) | 0},${g + 24},${(g * 0.5) | 0})`);
      }
    }
  });
  // 2 dirt
  fill(2, (ctx, x, y) => {
    noisy(ctx, x, y, [110, 78, 54], 26, 55);
    const r = rng(66);
    for (let k = 0; k < 18; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#4e3218');
  });
  // 3 stone
  fill(3, (ctx, x, y) => {
    noisy(ctx, x, y, [105, 105, 105], 22, 77);
    const r = rng(88);
    for (let k = 0; k < 14; k++) {
      const px2 = (r() * 16) | 0, py2 = (r() * 16) | 0;
      ctx.fillStyle = '#484848';
      ctx.fillRect(x + px2, y + py2, 1 + ((r() * 2) | 0), 1);
    }
  });
  // 4 sand
  fill(4, (ctx, x, y) => {
    noisy(ctx, x, y, [178, 162, 116], 16, 99);
    const r = rng(101);
    for (let k = 0; k < 10; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#9e7c4e');
  });
  // 5 wood top (rings)
  fill(5, (ctx, x, y) => {
    noisy(ctx, x, y, [130, 106, 72], 12, 121);
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        const dx = i - 7.5, dy = j - 7.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs((d % 3) - 1.5) < 0.4) px(ctx, x + i, y + j, '#6e5030');
      }
    }
  });
  // 6 wood side (bark)
  fill(6, (ctx, x, y) => {
    noisy(ctx, x, y, [96, 70, 46], 16, 133);
    const r = rng(144);
    for (let i = 0; i < 16; i++) {
      px(ctx, x + i, y, '#5e3e20');
      px(ctx, x + i, y + 15, '#5e3e20');
    }
    for (let i = 0; i < 16; i += 2) {
      for (let j = 1; j < 15; j++) {
        if (r() > 0.7) px(ctx, x + i, y + j, '#3c2c12');
      }
    }
  });
  // 7 leaves
  fill(7, (ctx, x, y) => {
    const r = rng(155);
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        const v = r();
        let c: string;
        if (v < 0.15) c = '#1e4418';
        else if (v < 0.5) c = '#2c6020';
        else if (v < 0.85) c = '#3a7e2c';
        else c = '#4a9438';
        px(ctx, x + i, y + j, c);
        if (r() < 0.05) ctx.clearRect(x + i, y + j, 1, 1);
      }
    }
  });
  // 8 planks
  fill(8, (ctx, x, y) => {
    noisy(ctx, x, y, [152, 122, 80], 10, 166);
    for (let j = 0; j < 16; j += 4) {
      for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#5e3e20');
    }
    const r = rng(177);
    for (let p = 0; p < 4; p++) {
      const nx = (r() * 16) | 0;
      const ny = ((r() * 4) | 0) + p * 4 + 1;
      px(ctx, x + nx, y + ny, '#3c2810');
    }
  });
  // 9 bricks
  fill(9, (ctx, x, y) => {
    noisy(ctx, x, y, [138, 56, 44], 22, 188);
    for (let j = 0; j < 16; j += 4) {
      for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#aea89a');
    }
    for (let j = 0; j < 16; j += 4) {
      const offset = ((j / 4) % 2 === 0) ? 0 : 4;
      for (let i = offset; i < 16; i += 8) {
        for (let k = 0; k < 4; k++) px(ctx, x + i, y + j + k, '#aea89a');
      }
    }
  });
  // 10 glass
  fill(10, (ctx, x, y) => {
    ctx.clearRect(x, y, TEX_SIZE, TEX_SIZE);
    for (let i = 0; i < 16; i++) {
      px(ctx, x + i, y, '#9ac0c8');
      px(ctx, x + i, y + 15, '#9ac0c8');
      px(ctx, x, y + i, '#9ac0c8');
      px(ctx, x + 15, y + i, '#9ac0c8');
    }
    px(ctx, x + 1, y + 1, '#d0e8ec');
    px(ctx, x + 2, y + 1, '#d0e8ec');
    px(ctx, x + 1, y + 2, '#d0e8ec');
  });
  // 11 stone bricks
  fill(11, (ctx, x, y) => {
    noisy(ctx, x, y, [114, 114, 114], 18, 199);
    for (let j = 0; j < 16; j += 8) {
      for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#484848');
    }
    for (let j = 0; j < 16; j += 8) {
      const offset = ((j / 8) % 2 === 0) ? 0 : 8;
      for (let i = offset; i < 16; i += 16) {
        for (let k = 0; k < 8; k++) px(ctx, x + i, y + j + k, '#484848');
      }
    }
  });
  // 12 cobblestone
  fill(12, (ctx, x, y) => {
    noisy(ctx, x, y, [88, 88, 88], 30, 211);
    const r = rng(222);
    for (let k = 0; k < 20; k++) {
      const cx2 = (r() * 14) | 0, cy2 = (r() * 14) | 0;
      const sz = 1 + ((r() * 2) | 0);
      ctx.fillStyle = r() > 0.5 ? '#686868' : '#3e3e3e';
      ctx.fillRect(x + cx2, y + cy2, sz, sz);
    }
  });
  // 13 snow
  fill(13, (ctx, x, y) => {
    noisy(ctx, x, y, [196, 202, 208], 14, 233);
    const r = rng(244);
    for (let k = 0; k < 8; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#dce4ea');
  });
  // 14 gravel
  fill(14, (ctx, x, y) => {
    noisy(ctx, x, y, [104, 98, 88], 30, 251);
    const r = rng(261);
    for (let k = 0; k < 18; k++) {
      const cx2 = (r() * 14) | 0, cy2 = (r() * 14) | 0;
      const sz = 1 + ((r() * 3) | 0);
      ctx.fillStyle = r() > 0.5 ? '#686258' : '#3c3830';
      ctx.fillRect(x + cx2, y + cy2, sz, sz);
    }
  });
  // 15 obsidian
  fill(15, (ctx, x, y) => {
    noisy(ctx, x, y, [26, 20, 36], 10, 271);
    const r = rng(281);
    for (let k = 0; k < 10; k++) {
      px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#3e2c60');
    }
    for (let k = 0; k < 4; k++) {
      px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#6a4a98');
    }
  });
  // 16 torch — transparent background, brown stick, orange flame
  fill(16, (ctx, x, y) => {
    ctx.clearRect(x, y, TEX_SIZE, TEX_SIZE);
    // Stick
    for (let j = 5; j < 15; j++) {
      px(ctx, x + 7, y + j, '#6b3a1f');
      px(ctx, x + 8, y + j, '#7d4420');
    }
    // Flame base (orange)
    for (let i = 6; i <= 9; i++) {
      for (let j = 2; j <= 6; j++) {
        px(ctx, x + i, y + j, '#e06010');
      }
    }
    // Flame core (yellow)
    for (let i = 7; i <= 8; i++) {
      for (let j = 1; j <= 4; j++) {
        px(ctx, x + i, y + j, '#ffe060');
      }
    }
    // Bright tip
    px(ctx, x + 7, y + 1, '#ffffff');
    px(ctx, x + 8, y + 1, '#ffffaa');
  });
  // 17 glowstone — warm amber, bright cross-hatch
  fill(17, (ctx, x, y) => {
    noisy(ctx, x, y, [200, 160, 40], 30, 291);
    const r = rng(301);
    for (let i = 0; i < 16; i++) {
      px(ctx, x + i, y + 8, `rgb(${220 + ((r() * 30) | 0)},${190 + ((r() * 30) | 0)},${80 + ((r() * 40) | 0)})`);
      px(ctx, x + 8, y + i, `rgb(${220 + ((r() * 30) | 0)},${190 + ((r() * 30) | 0)},${80 + ((r() * 40) | 0)})`);
    }
    for (let k = 0; k < 14; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#ffef90');
  });

  // 18 water — semi-transparent blue with wave highlights
  fill(18, (ctx, x, y) => {
    ctx.clearRect(x, y, TEX_SIZE, TEX_SIZE);
    ctx.fillStyle = 'rgba(28, 100, 210, 0.74)';
    ctx.fillRect(x, y, TEX_SIZE, TEX_SIZE);
    // diagonal wave bands
    for (let i = 0; i < 16; i++) {
      for (let j = 0; j < 16; j++) {
        if (((i + j * 2) % 7) < 2) {
          ctx.fillStyle = 'rgba(60, 140, 240, 0.45)';
          ctx.fillRect(x + i, y + j, 1, 1);
        }
      }
    }
    // light sparkle highlights
    const r = rng(311);
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = 'rgba(180, 220, 255, 0.55)';
      ctx.fillRect(x + ((r() * 15) | 0), y + ((r() * 15) | 0), 2, 1);
    }
  });

  // 19 sandstone side — layered yellowish stone
  fill(19, (ctx, x, y) => {
    noisy(ctx, x, y, [196, 170, 100], 14, 321);
    for (let j = 0; j < 16; j += 4) {
      for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#8c6e32');
    }
    const r = rng(331);
    for (let k = 0; k < 8; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#b89050');
  });

  // 20 sandstone top — smooth with chiselled pattern
  fill(20, (ctx, x, y) => {
    noisy(ctx, x, y, [196, 170, 100], 10, 341);
    for (let i = 3; i <= 12; i++) {
      px(ctx, x + i, y + 4, '#8c6e32');
      px(ctx, x + i, y + 11, '#8c6e32');
    }
    for (let j = 4; j <= 11; j++) {
      px(ctx, x + 3, y + j, '#8c6e32');
      px(ctx, x + 12, y + j, '#8c6e32');
    }
    px(ctx, x + 7, y + 7, '#c0a060');
    px(ctx, x + 8, y + 7, '#c0a060');
    px(ctx, x + 7, y + 8, '#c0a060');
    px(ctx, x + 8, y + 8, '#c0a060');
  });

  // 21 iron block — metallic silver grid
  fill(21, (ctx, x, y) => {
    noisy(ctx, x, y, [180, 180, 185], 12, 351);
    for (let i = 0; i < 16; i += 5) {
      for (let j = 0; j < 16; j++) px(ctx, x + i, y + j, '#909098');
    }
    for (let j = 0; j < 16; j += 5) {
      for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#909098');
    }
    const r = rng(361);
    for (let k = 0; k < 6; k++) px(ctx, x + ((r() * 15) | 0), y + ((r() * 15) | 0), '#d8d8e0');
  });

  // 22 gold block — golden with warm sheen
  fill(22, (ctx, x, y) => {
    noisy(ctx, x, y, [218, 180, 40], 18, 371);
    for (let i = 0; i < 16; i += 5) {
      for (let j = 0; j < 16; j++) px(ctx, x + i, y + j, '#a87c10');
    }
    for (let j = 0; j < 16; j += 5) {
      for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#a87c10');
    }
    const r = rng(381);
    for (let k = 0; k < 8; k++) px(ctx, x + ((r() * 15) | 0), y + ((r() * 15) | 0), '#ffe060');
  });

  // 23 diamond block — cyan sparkles
  fill(23, (ctx, x, y) => {
    noisy(ctx, x, y, [60, 196, 196], 16, 391);
    for (let i = 0; i < 16; i += 5) {
      for (let j = 0; j < 16; j++) px(ctx, x + i, y + j, '#1e8888');
    }
    for (let j = 0; j < 16; j += 5) {
      for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#1e8888');
    }
    const r = rng(401);
    for (let k = 0; k < 12; k++) px(ctx, x + ((r() * 15) | 0), y + ((r() * 15) | 0), '#a0f8f8');
    for (let k = 0; k < 4;  k++) px(ctx, x + ((r() * 15) | 0), y + ((r() * 15) | 0), '#ffffff');
  });

  // 24 red wool — fabric texture
  fill(24, (ctx, x, y) => {
    noisy(ctx, x, y, [160, 36, 36], 20, 411);
    for (let i = 0; i < 16; i += 2) {
      for (let j = 0; j < 16; j++) {
        if ((i + j) % 4 === 0) px(ctx, x + i, y + j, '#8c1818');
      }
    }
    const r = rng(421);
    for (let k = 0; k < 8; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#cc5050');
  });

  // 25 white wool — light fabric texture
  fill(25, (ctx, x, y) => {
    noisy(ctx, x, y, [230, 228, 224], 12, 431);
    for (let i = 0; i < 16; i += 2) {
      for (let j = 0; j < 16; j++) {
        if ((i + j) % 4 === 0) px(ctx, x + i, y + j, '#c0bdb8');
      }
    }
    const r = rng(441);
    for (let k = 0; k < 6; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#e8e6e0');
  });

  // 26 mossy cobblestone — cobblestone with green patches
  fill(26, (ctx, x, y) => {
    noisy(ctx, x, y, [82, 90, 78], 28, 451);
    const r = rng(461);
    for (let k = 0; k < 18; k++) {
      const cx2 = (r() * 14) | 0, cy2 = (r() * 14) | 0;
      const sz = 1 + ((r() * 2) | 0);
      ctx.fillStyle = r() > 0.5 ? '#606060' : '#383838';
      ctx.fillRect(x + cx2, y + cy2, sz, sz);
    }
    // moss patches
    for (let k = 0; k < 10; k++) {
      const mx = (r() * 14) | 0, my = (r() * 14) | 0;
      ctx.fillStyle = r() > 0.5 ? '#3a6e20' : '#2a5018';
      ctx.fillRect(x + mx, y + my, 1 + ((r() * 2) | 0), 1 + ((r() * 2) | 0));
    }
  });

  // 27 bookshelf side — planks with coloured book spines
  fill(27, (ctx, x, y) => {
    noisy(ctx, x, y, [148, 118, 76], 10, 471);
    // shelf dividers
    for (let j of [0, 5, 11, 15]) for (let i = 0; i < 16; i++) px(ctx, x + i, y + j, '#5e3e20');
    // book spines
    const bookColors = ['#c83030','#3050c8','#2e9030','#c89020','#901890','#208090'];
    const r = rng(481);
    let bx2 = 1;
    while (bx2 < 15) {
      const bw = 1 + ((r() * 2) | 0);
      const bc = bookColors[((r() * bookColors.length) | 0)];
      for (let dy = 1; dy <= 4; dy++) {
        for (let dx2 = 0; dx2 < bw && bx2 + dx2 < 15; dx2++) {
          px(ctx, x + bx2 + dx2, y + dy, bc);
          px(ctx, x + bx2 + dx2, y + dy + 6, bc);
        }
      }
      bx2 += bw + 1;
    }
  });

  // 28 netherrack — dark red jagged stone
  fill(28, (ctx, x, y) => {
    noisy(ctx, x, y, [100, 30, 28], 24, 491);
    const r = rng(501);
    for (let k = 0; k < 16; k++) {
      const cx2 = (r() * 14) | 0, cy2 = (r() * 14) | 0;
      ctx.fillStyle = r() > 0.5 ? '#6e1810' : '#2e0808';
      ctx.fillRect(x + cx2, y + cy2, 1 + ((r() * 2) | 0), 1);
    }
    for (let k = 0; k < 4; k++) px(ctx, x + ((r() * 16) | 0), y + ((r() * 16) | 0), '#d04030');
  });

  // 29 sponge — yellow with dark pores
  fill(29, (ctx, x, y) => {
    noisy(ctx, x, y, [194, 182, 60], 16, 511);
    const r = rng(521);
    for (let k = 0; k < 22; k++) {
      px(ctx, x + ((r() * 15) | 0), y + ((r() * 15) | 0), '#3a3010');
    }
    for (let k = 0; k < 8; k++) px(ctx, x + ((r() * 15) | 0), y + ((r() * 15) | 0), '#e0d060');
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

export const atlasTexture = buildAtlas();

// Redraws the water tile each frame — called from SceneSetup.useFrame.
// The atlas canvas is tiny (64×128 px) so GPU re-upload is cheap.
export function animateWater(time: number): void {
  const canvas = atlasTexture.image as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  const idx = 18; // water block atlas index
  const col = idx % ATLAS_COLS;
  const row = Math.floor(idx / ATLAS_COLS);
  const ox = col * TEX_SIZE;
  const oy = row * TEX_SIZE;

  ctx.clearRect(ox, oy, TEX_SIZE, TEX_SIZE);

  // Base deep blue, semi-transparent
  ctx.fillStyle = 'rgba(24, 90, 200, 0.76)';
  ctx.fillRect(ox, oy, TEX_SIZE, TEX_SIZE);

  // Scrolling diagonal wave bands — advances 5 pixels/second
  const shift = Math.floor(time * 5) % 7;
  for (let i = 0; i < TEX_SIZE; i++) {
    for (let j = 0; j < TEX_SIZE; j++) {
      if (((i + j * 2 + shift) % 7) < 2) {
        ctx.fillStyle = 'rgba(55, 135, 235, 0.48)';
        ctx.fillRect(ox + i, oy + j, 1, 1);
      }
    }
  }

  // Twinkling sparkles — new positions 4 times/second
  const r = rng((Math.floor(time * 4) * 7919 + 311) | 0);
  for (let k = 0; k < 7; k++) {
    const alpha = 0.38 + r() * 0.38;
    ctx.fillStyle = `rgba(160, 210, 255, ${alpha.toFixed(2)})`;
    ctx.fillRect(ox + ((r() * 15) | 0), oy + ((r() * 15) | 0), 2, 1);
  }

  atlasTexture.needsUpdate = true;
}
