import { BLOCKS } from './blocks';
import { atlasTexture } from './atlas';
import { TEX_SIZE, ATLAS_COLS } from './constants';

function rngIcon(seed: number) {
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

rngIcon; px; // keep lint happy

export function renderBlockIcon(blockId: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const block = BLOCKS[blockId];
  const topIdx  = block.tex.top  !== undefined ? block.tex.top  : block.tex.all!;
  const sideIdx = block.tex.side !== undefined ? block.tex.side : block.tex.all!;
  const atlasCanvas = atlasTexture.image as HTMLCanvasElement;

  function drawTile(srcIdx: number, dstPath: [number, number][], tint: number) {
    const sCol = srcIdx % ATLAS_COLS;
    const sRow = Math.floor(srcIdx / ATLAS_COLS);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dstPath[0][0], dstPath[0][1]);
    for (let i = 1; i < dstPath.length; i++) ctx.lineTo(dstPath[i][0], dstPath[i][1]);
    ctx.closePath();
    ctx.clip();
    const xs = dstPath.map(p => p[0]);
    const ys = dstPath.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    ctx.drawImage(atlasCanvas, sCol * TEX_SIZE, sRow * TEX_SIZE, TEX_SIZE, TEX_SIZE,
      minX, minY, maxX - minX, maxY - minY);
    ctx.fillStyle = `rgba(0,0,0,${1 - tint})`;
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
  }

  drawTile(topIdx,  [[16,2],[30,9],[16,17],[2,9]],    1.0);
  drawTile(sideIdx, [[2,9],[16,17],[16,30],[2,22]],   0.78);
  drawTile(sideIdx, [[16,17],[30,9],[30,22],[16,30]], 0.60);

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2,9); ctx.lineTo(16,2); ctx.lineTo(30,9); ctx.lineTo(30,22);
  ctx.lineTo(16,30); ctx.lineTo(2,22); ctx.closePath();
  ctx.moveTo(2,9); ctx.lineTo(16,17); ctx.lineTo(30,9);
  ctx.moveTo(16,17); ctx.lineTo(16,30);
  ctx.stroke();
  return c;
}

export function renderItemIcon(id: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  if (id >= 256 && id <= 259) {
    // Pickaxe
    const heads = ['#A0522D','#9E9E9E','#D8D8D8','#5DE1E6'];
    const darks = ['#7B3B1A','#6B6B6B','#ABABAB','#2ABFC5'];
    const col = heads[id - 256], dark = darks[id - 256];
    // Head
    ctx.fillStyle = col;
    ctx.fillRect(4, 6, 16, 4);
    ctx.fillRect(4, 2, 6, 8);
    ctx.fillRect(16, 2, 4, 8);
    ctx.fillStyle = dark;
    ctx.fillRect(4, 8, 16, 2);
    ctx.fillRect(6, 4, 2, 2);
    // Handle (diagonal)
    ctx.fillStyle = '#8B5E3C';
    for (let i = 0; i < 12; i++) ctx.fillRect(12 + i, 10 + i, 3, 3);
    ctx.fillStyle = '#6B4423';
    for (let i = 0; i < 12; i++) ctx.fillRect(14 + i, 10 + i, 1, 3);
  } else if (id >= 260 && id <= 263) {
    // Sword
    const blades = ['#A0522D','#9E9E9E','#D8D8D8','#5DE1E6'];
    const darks  = ['#7B3B1A','#6B6B6B','#ABABAB','#2ABFC5'];
    const col = blades[id - 260], dark = darks[id - 260];
    // Tip
    ctx.fillStyle = col;
    ctx.fillRect(15, 0, 2, 2);
    // Blade
    ctx.fillRect(14, 2, 4, 20);
    ctx.fillStyle = dark;
    ctx.fillRect(15, 2, 1, 20);
    // Guard
    ctx.fillStyle = '#B8A030';
    ctx.fillRect(7, 20, 18, 4);
    ctx.fillStyle = '#8A7520';
    ctx.fillRect(7, 22, 18, 2);
    // Handle
    ctx.fillStyle = '#7B3B1A';
    ctx.fillRect(13, 24, 6, 8);
    ctx.fillStyle = '#6B4423';
    ctx.fillRect(14, 24, 1, 8);
  } else if (id === 264) {
    // Bread
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(6, 16, 20, 10);
    ctx.fillRect(8, 10, 16, 8);
    ctx.fillRect(10, 8, 12, 4);
    ctx.fillStyle = '#C8722B';
    ctx.fillRect(8, 12, 16, 4);
    ctx.fillRect(6, 18, 20, 2);
    ctx.fillStyle = '#F4A460';
    ctx.fillRect(10, 14, 12, 8);
    ctx.fillStyle = '#DEB887';
    ctx.fillRect(10, 10, 8, 4);
    ctx.fillRect(10, 14, 4, 4);
  } else if (id === 265) {
    // Apple
    ctx.fillStyle = '#228B22';
    ctx.fillRect(14, 2, 3, 4);
    ctx.fillRect(16, 4, 6, 4);
    ctx.fillStyle = '#CC2200';
    ctx.fillRect(8, 6, 16, 2);
    ctx.fillRect(6, 8, 20, 4);
    ctx.fillRect(4, 12, 24, 8);
    ctx.fillRect(6, 20, 20, 4);
    ctx.fillRect(8, 24, 16, 2);
    ctx.fillStyle = '#FF4422';
    ctx.fillRect(8, 8, 6, 4);
    ctx.fillRect(6, 12, 4, 4);
    ctx.fillStyle = '#FF8866';
    ctx.fillRect(10, 10, 4, 4);
    ctx.fillRect(8, 14, 2, 2);
  } else if (id === 266) {
    // Raw Beef — pink-red steak
    ctx.fillStyle = '#c0453a'; ctx.fillRect(6, 10, 20, 14);
    ctx.fillRect(8, 7, 16, 5);
    ctx.fillStyle = '#e8786e'; ctx.fillRect(8, 11, 8, 4);
    ctx.fillRect(14, 15, 6, 3);
    ctx.fillStyle = '#f4c8c0'; ctx.fillRect(10, 13, 4, 3);
    ctx.fillStyle = '#9c2a22'; ctx.fillRect(6, 20, 20, 4);
  } else if (id === 267) {
    // Cooked Beef — dark brown steak
    ctx.fillStyle = '#5c3010'; ctx.fillRect(6, 10, 20, 14);
    ctx.fillRect(8, 7, 16, 5);
    ctx.fillStyle = '#8b5020'; ctx.fillRect(8, 11, 10, 4);
    ctx.fillRect(16, 16, 6, 3);
    ctx.fillStyle = '#3a1a06'; ctx.fillRect(6, 20, 20, 4);
    ctx.fillRect(10, 14, 3, 2); ctx.fillRect(17, 11, 3, 2);
  } else if (id === 268) {
    // Rotten Flesh — greenish-grey torn meat
    ctx.fillStyle = '#5a6840'; ctx.fillRect(6, 9, 18, 14);
    ctx.fillRect(4, 13, 6, 6);
    ctx.fillRect(22, 11, 6, 6);
    ctx.fillStyle = '#7a8a58'; ctx.fillRect(8, 11, 6, 4);
    ctx.fillRect(16, 15, 6, 3);
    ctx.fillStyle = '#3a4428'; ctx.fillRect(7, 18, 4, 3);
    ctx.fillRect(14, 13, 3, 2);
    ctx.fillRect(20, 17, 3, 2);
  } else if (id >= 270 && id <= 277) {
    const isIron    = id <= 273;
    const piece     = isIron ? id - 270 : id - 274; // 0=helm 1=chest 2=legs 3=boots
    const col  = isIron ? '#9eacb4' : '#5de8e8';
    const dark = isIron ? '#6a7e88' : '#28b0b0';
    const mid  = isIron ? '#b8ccd4' : '#80f0f0';

    if (piece === 0) {
      // Helmet — dome + ear guards + visor
      ctx.fillStyle = col;
      ctx.fillRect(8, 6, 16, 10);  // dome
      ctx.fillRect(6, 10, 4, 8);   // left ear
      ctx.fillRect(22, 10, 4, 8);  // right ear
      ctx.fillStyle = dark;
      ctx.fillRect(8, 14, 16, 2);  // visor top
      ctx.fillRect(8, 6, 16, 2);   // dome top
      ctx.fillStyle = mid;
      ctx.fillRect(10, 8, 4, 4);   // highlight
    } else if (piece === 1) {
      // Chestplate — pauldrons + torso
      ctx.fillStyle = col;
      ctx.fillRect(4, 4, 6, 6);    // left pauldron
      ctx.fillRect(22, 4, 6, 6);   // right pauldron
      ctx.fillRect(8, 8, 16, 18);  // torso
      ctx.fillStyle = dark;
      ctx.fillRect(8, 8, 16, 2);   // top ridge
      ctx.fillRect(8, 22, 16, 4);  // waist
      ctx.fillStyle = mid;
      ctx.fillRect(11, 10, 4, 6);  // highlight
    } else if (piece === 2) {
      // Leggings — waistband + two legs
      ctx.fillStyle = col;
      ctx.fillRect(6, 4, 20, 6);   // waistband
      ctx.fillRect(6, 8, 9, 20);   // left leg
      ctx.fillRect(17, 8, 9, 20);  // right leg
      ctx.fillStyle = dark;
      ctx.fillRect(6, 4, 20, 2);
      ctx.fillRect(14, 8, 4, 20);  // center seam
      ctx.fillStyle = mid;
      ctx.fillRect(8, 6, 4, 8);
    } else {
      // Boots — foot + ankle
      ctx.fillStyle = col;
      ctx.fillRect(5, 8, 10, 14);  // left boot
      ctx.fillRect(17, 8, 10, 14); // right boot
      ctx.fillRect(5, 20, 12, 6);  // left sole
      ctx.fillRect(15, 20, 12, 6); // right sole
      ctx.fillStyle = dark;
      ctx.fillRect(5, 8, 10, 2);
      ctx.fillRect(17, 8, 10, 2);
      ctx.fillRect(5, 24, 12, 2);
      ctx.fillRect(15, 24, 12, 2);
      ctx.fillStyle = mid;
      ctx.fillRect(7, 10, 4, 6);
      ctx.fillRect(19, 10, 4, 6);
    }
  } else if (id === 278) {
    // String — thin white/grey lines
    ctx.fillStyle = '#cccccc';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(8 + i * 5, 4,  2, 24);
    }
    ctx.fillStyle = '#999999';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(9 + i * 5, 4,  1, 24);
    }
  } else if (id === 279) {
    // Gunpowder — dark grey rough grain pile
    ctx.fillStyle = '#444444'; ctx.fillRect(8, 14, 16, 10);
    ctx.fillRect(10, 11, 12, 5);
    ctx.fillStyle = '#222222'; ctx.fillRect(8, 20, 16, 4);
    ctx.fillStyle = '#666666';
    ctx.fillRect(10, 13, 4, 3); ctx.fillRect(18, 15, 4, 3);
    ctx.fillRect(14, 11, 3, 2); ctx.fillRect(11, 17, 3, 2);
    ctx.fillStyle = '#888888';
    ctx.fillRect(12, 14, 2, 2); ctx.fillRect(19, 12, 2, 2);
  } else if (id === 280) {
    // Bow — curved arc with string
    ctx.strokeStyle = '#7a5028'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(18, 16, 10, Math.PI*0.55, Math.PI*1.45); ctx.stroke();
    ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(9, 7); ctx.lineTo(9, 25); ctx.stroke();
    ctx.fillStyle = '#8b5e30';
    ctx.fillRect(7, 7, 4, 4); ctx.fillRect(7, 21, 4, 4);
    ctx.fillStyle = '#6b3e18';
    ctx.fillRect(8, 9, 2, 14);
  } else if (id === 281) {
    // Arrow — shaft + tip + fletching
    ctx.fillStyle = '#5a3a18'; // shaft
    for (let i = 0; i < 18; i++) ctx.fillRect(7 + i, 14 + i % 2, 2, 2);
    ctx.fillStyle = '#cccccc'; // metal tip
    ctx.fillRect(24, 12, 4, 2); ctx.fillRect(25, 10, 3, 2);
    ctx.fillRect(26, 8, 2, 2); ctx.fillRect(27, 6, 1, 3);
    ctx.fillStyle = '#cc3333'; // fletching
    ctx.fillRect(4, 8, 4, 3); ctx.fillRect(4, 18, 4, 3);
    ctx.fillStyle = '#aa2222';
    ctx.fillRect(4, 9, 3, 1); ctx.fillRect(4, 19, 3, 1);
  } else if (id === 282) {
    // Wooden Hoe — L-shape head + handle
    ctx.fillStyle = '#8B5E3C'; ctx.fillRect(14, 4, 4, 10); ctx.fillRect(10, 4, 10, 4);
    ctx.fillStyle = '#6B4423'; ctx.fillRect(15, 6, 2, 8); ctx.fillRect(10, 5, 10, 1);
    ctx.fillStyle = '#7B5030'; for (let i = 0; i < 14; i++) ctx.fillRect(8 + i, 12 + i, 3, 3);
  } else if (id === 283) {
    // Wheat Seeds — small tan grains
    ctx.fillStyle = '#c8b060';
    for (let i = 0; i < 5; i++) { const xi = [6,14,10,4,18][i], yi = [8,6,14,18,16][i]; ctx.fillRect(xi,yi,4,4); }
    ctx.fillStyle = '#a89040';
    for (let i = 0; i < 5; i++) { const xi = [6,14,10,4,18][i], yi = [8,6,14,18,16][i]; ctx.fillRect(xi+1,yi+2,2,1); }
  } else if (id === 284) {
    // Wheat — golden bundle
    ctx.fillStyle = '#d4a030';
    ctx.fillRect(8, 4, 4, 20); ctx.fillRect(16, 4, 4, 20);
    ctx.fillRect(12, 6, 4, 16);
    ctx.fillStyle = '#e8c050';
    ctx.fillRect(8, 4, 4, 6); ctx.fillRect(16, 4, 4, 6); ctx.fillRect(12, 6, 4, 6);
    ctx.fillStyle = '#b08020';
    ctx.fillRect(7, 20, 18, 4); // binding
  } else if (id === 285) {
    // Slimeball — green sphere
    ctx.fillStyle = '#3a9a20';
    ctx.fillRect(8, 6, 16, 4); ctx.fillRect(6, 10, 20, 12); ctx.fillRect(8, 22, 16, 4);
    ctx.fillStyle = '#60c840';
    ctx.fillRect(10, 8, 6, 4); ctx.fillRect(8, 12, 4, 4);
    ctx.fillStyle = '#1a6010';
    ctx.fillRect(8, 22, 16, 2); ctx.fillRect(20, 14, 4, 6);
  } else if (id === 286) {
    // Healing Potion — red bottle
    ctx.fillStyle = '#884040'; ctx.fillRect(13, 2, 6, 5); // cork
    ctx.fillStyle = '#cc2020';
    ctx.fillRect(10, 7, 12, 4); ctx.fillRect(8, 10, 16, 14); ctx.fillRect(10, 24, 12, 4);
    ctx.fillStyle = '#ff6060'; ctx.fillRect(10, 10, 4, 6); ctx.fillRect(10, 18, 4, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(11, 11, 2, 3); // shine
  } else if (id === 287) {
    // Speed Potion — blue bottle
    ctx.fillStyle = '#404088'; ctx.fillRect(13, 2, 6, 5);
    ctx.fillStyle = '#2040cc';
    ctx.fillRect(10, 7, 12, 4); ctx.fillRect(8, 10, 16, 14); ctx.fillRect(10, 24, 12, 4);
    ctx.fillStyle = '#6080ff'; ctx.fillRect(10, 10, 4, 6); ctx.fillRect(10, 18, 4, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(11, 11, 2, 3);
  } else if (id === 288) {
    // Strength Potion — orange bottle
    ctx.fillStyle = '#886020'; ctx.fillRect(13, 2, 6, 5);
    ctx.fillStyle = '#c06010';
    ctx.fillRect(10, 7, 12, 4); ctx.fillRect(8, 10, 16, 14); ctx.fillRect(10, 24, 12, 4);
    ctx.fillStyle = '#ff9030'; ctx.fillRect(10, 10, 4, 6); ctx.fillRect(10, 18, 4, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(11, 11, 2, 3);
  } else if (id === 289) {
    // Blaze Rod — golden orange rod
    ctx.fillStyle = '#d08010';
    for (let i = 0; i < 22; i++) ctx.fillRect(13, 4 + i, 6, 1);
    ctx.fillStyle = '#f0b030'; ctx.fillRect(14, 4, 4, 10);
    ctx.fillStyle = '#ffd060'; ctx.fillRect(14, 5, 2, 4);
  } else {
    // Unknown item — gray square
    ctx.fillStyle = '#666';
    ctx.fillRect(4, 4, 24, 24);
    ctx.fillStyle = '#888';
    ctx.fillRect(6, 6, 20, 20);
  }

  return c;
}

export function renderAtlasTile(idx: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = TEX_SIZE; c.height = TEX_SIZE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const col = idx % ATLAS_COLS;
  const row = Math.floor(idx / ATLAS_COLS);
  ctx.drawImage(
    atlasTexture.image as HTMLCanvasElement,
    col * TEX_SIZE, row * TEX_SIZE, TEX_SIZE, TEX_SIZE,
    0, 0, TEX_SIZE, TEX_SIZE,
  );
  return c;
}

export function renderAnyIcon(id: number): HTMLCanvasElement {
  if (id === 0) {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    return c;
  }
  if (id >= 256) return renderItemIcon(id);
  return renderBlockIcon(id);
}
