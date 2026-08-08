/* ============================================================
   ui/heatmap.js —— Canvas 2D 热力图渲染
   映射约定：values[r*cols+c]
     - r (行)  = 距窗深度 ↑ → 向下距离越大
     - c (列) = 横向（宽度方向）
     - 窗户在顶部（r=0 所在边）
   ============================================================ */

import { THRESHOLD } from '../constants.js';

/* ---------- 颜色查找表：Lux → RGB ----------
   弱<150 蓝 → 舒适 150~橙 → 过强红 */
const STOPS = [
  { v:    0, rgb: [30,  41,  59] },   // 几乎无光：深蓝灰
  { v:  150, rgb: [ 59, 130, 246] },   // 弱
  { v:  300, rgb: [147, 197, 253] },
  { v:  600, rgb: [253, 224,  71] },
  { v: 1500, rgb: [251, 146,  60] },
  { v: 6000, rgb: [239,  68,  68] },
  { v:12000, rgb: [220,  38,  38] },   // 极强
];

function lerp(a, b, t) { return a + (b - a) * t; }

export function heatColor(e) {
  if (e <= 0) return STOPS[0].rgb;
  for (let i = 1; i < STOPS.length; i++) {
    if (e < STOPS[i].v) {
      const a = STOPS[i - 1], b = STOPS[i];
      const t = (e - a.v) / (b.v - a.v);
      return [
        Math.round(lerp(a.rgb[0], b.rgb[0], t)),
        Math.round(lerp(a.rgb[1], b.rgb[1], t)),
        Math.round(lerp(a.rgb[2], b.rgb[2], t)),
      ];
    }
  }
  return STOPS[STOPS.length - 1].rgb;
}

/* 基于屏幕矩形内一小块网格平均颜色绘制矩形 */
function drawCell(ctx, x, y, w, h, e) {
  const [r, g, b] = heatColor(e);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(x, y, w, h);
}

/* ---------- 公开：绘制热力图 ---------- */
export function renderHeatmap(canvas, grid, input) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const { cols, rows, values, step } = grid;

  // 内边距与绘图区
  const pad = { l: 46, r: 14, t: 36, b: 22 };
  const dW = W - pad.l - pad.r;
  const dH = H - pad.t - pad.b;

  // 长宽等比：用真实 width/depth 让客厅比例接近真实
  const realW = input.width;
  const realD = input.depth;
  // 这里把房间横向铺满 dW，纵向按实际比例
  const ratioW = dW / cols;
  const ratioH = dH / rows;

  // 清空
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, W, H);

  // 网格热力（用整数步长微量缩放以消除缝隙）
  for (let r = 0; r < rows; r++) {
    const y = pad.t + r * ratioH;
    for (let c = 0; c < cols; c++) {
      const x = pad.l + c * ratioW;
      drawCell(ctx, x, y, ratioW + 0.5, ratioH + 0.5, values[r * cols + c]);
    }
  }

  // ---------- 顶部窗户示意 ----------
  const winStart = (realW - input.windowWidth) / 2;
  const winPixStart = pad.l + (winStart / realW) * dW;
  const winPixW = (input.windowWidth / realW) * dW;
  ctx.strokeStyle = '#FCD34D';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(winPixStart, pad.t - 6);
  ctx.lineTo(winPixStart + winPixW, pad.t - 6);
  ctx.stroke();
  ctx.fillStyle = '#FDE68A';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('窗户', winPixStart + winPixW / 2, pad.t - 14);

  // ---------- 距离标尺（左） ----------
  ctx.fillStyle = '#94A3B8';
  ctx.textAlign = 'right';
  ctx.font = '10px sans-serif';
  const maxD = Math.floor(realD);
  for (let m = 0; m <= maxD; m++) {
    const y = pad.t + (m / realD) * dH;
    ctx.beginPath();
    ctx.moveTo(pad.l - 4, y);
    ctx.lineTo(pad.l, y);
    ctx.strokeStyle = '#94A3B8';
    ctx.stroke();
    ctx.fillText(`${m}m`, pad.l - 7, y + 3);
  }

  // ---------- 朝向图标（右下角） ----------
  ctx.fillStyle = '#FDE68A';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`朝向 ${input.orientation}`, W - pad.r, H - 6);
}
