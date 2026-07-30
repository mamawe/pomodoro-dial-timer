/* ============================================================
   ui/form.js —— 输入页控件绑定
   ⚠️ 仅负责把 DOM 交互同步到 store，不写任何计算逻辑
   ============================================================ */

import { get, set, ORIENTATION_LABEL } from '../store.js';

/* ---------- 滑杆：必填三个尺寸 ---------- */
function bindRange(field, key) {
  const wrap = document.querySelector(`[data-field="${field}"]`);
  if (!wrap) return;
  const input = wrap.querySelector('input[type="range"]');
  const valEl = wrap.querySelector('[data-val]');
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    valEl.textContent = v.toFixed(key === 'width' || key === 'depth' ? 1 : 1);
    set({ [key]: v });
  });
  // 初始化一次
  valEl.textContent = parseFloat(input.value).toFixed(1);
}

/* ---------- 滑杆：横向类（冠幅）---------- */
function bindNamedRange(field, key, decimals = 0) {
  const wrap = document.querySelector(`[data-field="${field}"]`);
  if (!wrap) return;
  const input = wrap.querySelector('input[type="range"]');
  const valEl = wrap.querySelector('[data-val]');
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    valEl.textContent = v.toFixed(decimals);
    set({ [key]: v });
  });
  valEl.textContent = parseFloat(input.value).toFixed(decimals);
}

/* ---------- chips 切换 ---------- */
function bindChips(field, key, nodeName = '.chip') {
  const wrap = document.querySelector(`[data-field="${field}"]`);
  if (!wrap) return;
  const buttons = wrap.querySelectorAll(nodeName);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      let v = btn.dataset.value;
      if (key === 'floor' || key === 'treeFloor') v = parseInt(v, 10);
      set({ [key]: v });
    });
  });
}

/* ---------- 罗盘朝向 ---------- */
function bindCompass() {
  const compass = document.querySelector('.compass[data-field="orientation"]');
  if (!compass) return;
  const buttons = compass.querySelectorAll('.compass-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      set({ orientation: btn.dataset.value });
    });
  });
}

/* ---------- 树木开关 ---------- */
function bindTreeSwitch() {
  const sw = document.querySelector('input[type="checkbox"][data-field="hasTree"]');
  const panel = document.querySelector('.tree-panel');
  if (!sw) return;
  sw.addEventListener('change', () => {
    set({ hasTree: sw.checked });
    panel.hidden = !sw.checked;
  });
}

/* ---------- 公共：根据 store 回写 UI（前进返回时保持一致）---------- */
export function syncFormFromStore() {
  const form = get().form;

  // 三个主滑杆
  const rangeW = document.querySelector('[data-field="width"] input');
  if (rangeW) { rangeW.value = form.width;
                document.querySelector('[data-field="width"] [data-val]').textContent = form.width.toFixed(1); }
  const rangeD = document.querySelector('[data-field="depth"] input');
  if (rangeD) { rangeD.value = form.depth;
                document.querySelector('[data-field="depth"] [data-val]').textContent = form.depth.toFixed(1); }
  const rangeWin = document.querySelector('[data-field="windowWidth"] input');
  if (rangeWin) { rangeWin.value = form.windowWidth;
                  document.querySelector('[data-field="windowWidth"] [data-val]').textContent = form.windowWidth.toFixed(1); }

  // 树冠
  const rangeCrown = document.querySelector('[data-field="crownWidth"] input');
  if (rangeCrown) { rangeCrown.value = form.crownWidth;
                   document.querySelector('[data-field="crownWidth"] [data-val]').textContent = form.crownWidth.toFixed(0); }

  // 朝向
  document.querySelectorAll('.compass-btn').forEach(b => {
    b.classList.toggle('is-active', b.dataset.value === form.orientation);
  });

  // chips
  const map = {
    floor: form.floor,
    glass: form.glass,
    frame: form.frame,
    treeSpecies: form.treeSpecies,
    treeFloor: form.treeFloor,
  };
  for (const [field, v] of Object.entries(map)) {
    const wrap = document.querySelector(`[data-field="${field}"]`);
    if (!wrap) continue;
    wrap.querySelectorAll('.chip').forEach(b => {
      let bVal = b.dataset.value;
      if (field === 'floor' || field === 'treeFloor') bVal = parseInt(bVal, 10);
      b.classList.toggle('is-active', bVal === v);
    });
  }

  // 树开关
  const treeSw = document.querySelector('input[type="checkbox"][data-field="hasTree"]');
  const treePanel = document.querySelector('.tree-panel');
  if (treeSw) { treeSw.checked = form.hasTree; treePanel.hidden = !form.hasTree; }
}

/* ---------- 启动 ---------- */
export function initForm() {
  bindRange('width', 'width');
  bindRange('depth', 'depth');
  bindRange('windowWidth', 'windowWidth');
  bindNamedRange('crownWidth', 'crownWidth', 0);
  bindCompass();
  bindChips('floor', 'floor');
  bindChips('glass', 'glass');
  bindChips('frame', 'frame');
  bindChips('treeSpecies', 'treeSpecies');
  bindChips('treeFloor', 'treeFloor');
  bindTreeSwitch();
  syncFormFromStore();
}
