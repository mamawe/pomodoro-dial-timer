/* ============================================================
   store.js —— 极简发布/订阅状态管理
   负责：表单参数（form）+ 场景参数（scenario）+ 观测点
   不使用任何框架，便于后续迁移到 Vue/React 或纯原生
   ============================================================ */
const listeners = new Set();

/* ---------- 默认状态 ---------- */
const DEFAULT_FORM = {
  // 必填
  width: 3.6,          // 客厅面宽 m
  depth: 4.5,          // 客厅进深 m
  windowWidth: 1.8,    // 窗户总宽 m

  // 选填（有默认值）
  orientation: 'S',    // N | E | S | W | SE | SW
  floor: 2,            // 楼层 1-4
  glass: 'clear',      // clear | lowe | ultra
  frame: 'plastic',    // plastic | thermal

  // 树木选填
  hasTree: false,
  treeSpecies: 'wutong',  // wutong | yinxing | xiangzhang | guohuai | baila
  treeFloor: 1,
  crownWidth: 6,           // 树冠覆盖宽度 m
};

const DEFAULT_SCENARIO = {
  season: 'summer',     // spring | summer | autumn | winter
  weather: 'sunny',     // sunny | cloudy | overcast
  slot: 'noon',         // morning | noon | afternoon
};

let state = {
  form: { ...DEFAULT_FORM },
  scenario: { ...DEFAULT_SCENARIO },
};

/* ---------- 工具函数 ---------- */
export function get() { return state; }

export function getForm() { return state.form; }

export function getScenario() { return state.scenario; }

export function set(formPatch, scenarioPatch) {
  if (formPatch)  Object.assign(state.form, formPatch);
  if (scenarioPatch) Object.assign(state.scenario, scenarioPatch);
  listeners.forEach(fn => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------- 方向可读文本映射（供 UI 显示） ---------- */
export const ORIENTATION_LABEL = {
  N: '正北', E: '正东', S: '正南', W: '正西',
  SE: '东南', SW: '西南',
};

export const FLOOR_LABEL = { 1: '1 层', 2: '2 层', 3: '3 层', 4: '4 层' };
