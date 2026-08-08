/* ============================================================
   ui/workspace.js —— 工作区：户型摘要 + 场景切换 + 统计卡 + 热力图重绘
   ============================================================ */

import { get, set, subscribe, ORIENTATION_LABEL, FLOOR_LABEL } from '../store.js';
import { computeGrid } from '../engine/index.js';
import { renderHeatmap } from './heatmap.js';

/* ---------- 公开：进入视图时调用 ---------- */
export function enterWorkspace() {
  renderWorkspace();             // 首次绘制全屏
  bindScenarioControls();       // 绑定场景切换
  // 订阅 store，场景变化时仅重绘热力图（避免整页闪烁）
  get()._unsubWs = subscribe(redrawOnly);
}

export function leaveWorkspace() {
  const s = get();
  if (s._unsubWs) { s._unsubWs(); delete s._unsubWs; }
}

/* ---------- 重新绘制整个工作区 ---------- */
function renderWorkspace() {
  const form = get().form;
  document.querySelector('[data-sum="orientation"]').textContent = ORIENTATION_LABEL[form.orientation];
  document.querySelector('[data-sum="floor"]').textContent     = FLOOR_LABEL[form.floor] || `${form.floor} 层`;
  document.querySelector('[data-sum="size"]').textContent      = `${form.width.toFixed(1)} × ${form.depth.toFixed(1)} m`;
  document.querySelector('[data-sum="window"]').textContent    = `窗 ${form.windowWidth.toFixed(1)} m`;
  bindScenarioControls();       // 重置场景选中态
  redrawOnly();
}

/* ---------- 仅重绘：热力图 + 统计卡（不重绑事件） ---------- */
function redrawOnly() {
  const { form, scenario } = get();
  const grid = computeGrid(form, scenario);
  const canvas = document.getElementById('heatmap');
  renderHeatmap(canvas, grid, form);
  renderStats(grid.stats);
}

/* ---------- 场景切换（分段控件） ---------- */
function bindScenarioControls() {
  const scenario = get().scenario;
  document.querySelectorAll('.scenario-group').forEach(group => {
    const key = group.dataset.scenario;
    const buttons = group.querySelectorAll('.segmented button');
    // 初始化选中态
    buttons.forEach(b => b.classList.toggle('is-active', b.dataset.value === scenario[key]));
    // 绑定事件
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        set(null, { [key]: btn.dataset.value });
      });
    });
  });
}

/* ---------- 统计卡（平均照度 / 舒适区占比 / 暴晒风险） ---------- */
function renderStats(stats) {
  const els = {
    mean: document.querySelector('[data-stat="mean"]'),
    comfort: document.querySelector('[data-stat="comfort"]'),
    glare: document.querySelector('[data-stat="glare"]'),
    glareCard: document.querySelector('[data-stat-card="glare"]'),
  };
  const mean = Math.round(stats.mean);
  els.mean.textContent = mean.toFixed(0);
  const comfortPct = Math.round(stats.comfortRatio * 100);
  els.comfort.textContent = `${comfortPct}%`;
  const overRatio = stats.overexposeRatio || 0;
  if (overRatio > 0.05) {
    els.glare.textContent = '⚠ 有风险';
    els.glare.classList.add('is-warn');
    els.glareCard.style.border = `1px solid var(--color-bad)`;
  } else {
    els.glare.textContent = '✓ 无';
    els.glare.classList.remove('is-warn');
    els.glareCard.style.border = '';
  }
}
