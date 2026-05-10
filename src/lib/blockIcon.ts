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

rngIcon; px; // keep lint happy — used in future texture helpers

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
