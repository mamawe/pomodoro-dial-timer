/* ============================================================
   ui/report.js —— 年度报告：头条数字 + 进度条动画 + 风险与建议文案
   ============================================================ */

import { get } from '../store.js';
import { computeAnnual } from '../engine/index.js';

/* ---------- 公开：进入视图时调用 ---------- */
export function enterReport() {
  const form = get().form;
  const data = computeAnnual(form);
  renderReport(data, form);
}

function renderReport(data, form) {
  // 头条数字
  animateNumber(document.querySelector('[data-report="goodLight"]'), 0, data.goodLight, 900);
  document.querySelector('[data-report="goodLight2"]').textContent = data.goodLight;
  document.querySelector('[data-report="subtitle"]').textContent = data.subtitle;

  // 进度条
  setTimeout(() => {
    document.querySelector('[data-bar="goodLight"]').style.width = `${Math.min(99, data.goodLight)}%`;
    document.querySelector('[data-bar="overexpose"]').style.width = `${Math.max(2, data.overexpose)}%`;
  }, 60);

  // 建议文案
  document.querySelector('[data-report="risk"]').textContent = data.risk;
  document.querySelector('[data-report="tip"]').textContent  = data.tip;}

/* ---------- 数字滚动动画 ---------- */
function animateNumber(el, from, to, duration) {
  if (!el) return;
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);   // easeOutCubic
    el.textContent = Math.round(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
