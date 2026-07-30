/* ============================================================
   main.js —— 路由与视图调度
   四个视图：home / input / workspace / report
   使用 hash 路由（#/workspace 等），不依赖任何框架
   ============================================================ */

import { syncFormFromStore, initForm } from './ui/form.js';
import { enterWorkspace, leaveWorkspace } from './ui/workspace.js';
import { enterReport } from './ui/report.js';

const VIEWS = ['home', 'input', 'workspace', 'report'];
const viewNodes = {};

/* ---------- 启动 ---------- */
function boot() {
  // 缓存视图节点
  VIEWS.forEach(v => {
    viewNodes[v] = document.querySelector(`[data-view="${v}"]`);
  });

  // hashchange + 首次加载
  window.addEventListener('hashchange', route);
  route();
}

/* ---------- 路由 ---------- */
function route() {
  const hash = window.location.hash.replace('#', '') || '/home';
  const view = hash.replace(/^\//, '').split('?')[0];
  const target = VIEWS.includes(view) ? view : 'home';

  // 离开 workspace 视图时清理订阅（仅当上一个视图就是 workspace 时）
  if (target !== 'workspace') leaveWorkspace();

  // 隐藏全部，显示目标
  Object.entries(viewNodes).forEach(([v, node]) => {
    node.classList.toggle('is-active', v === target);
  });

  // 切换后重置滚动位置（移动端友好）
  window.scrollTo(0, 0);

  // 视图进入时初始化（应用当前 store 状态）
  switch (target) {
    case 'home':
      break;
    case 'input':
      syncFormFromStore();   // 从报告页返回时回填表单
      break;
    case 'workspace':
      enterWorkspace();      // 首次进入时绑定场景切换 + 绘制热力图
      break;
    case 'report':
      enterReport();         // 首次进入时计算年度指标
      break;
  }
}

/* ---------- 分享按钮（占位，V3 实现 html2canvas 导出） ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initForm();
  document.getElementById('btn-share')?.addEventListener('click', () => {
    alert('V3 将接入分享图导出功能；当前版本暂不可用。');
  });
  boot();
});

export { route };
