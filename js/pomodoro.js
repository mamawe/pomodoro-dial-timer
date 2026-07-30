/* ============================================================
   暖红拨盘番茄钟 —— 双拨盘交互 + 倒计时 + 专注度检测
   纯原生 JS 实现，不依赖任何框架
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 几何常量 (viewBox 360x360) ---------- */
  const VB = 360;                  // SVG viewBox 尺寸
  const CX = VB;                   // 圆心 X = 右下角
  const CY = VB;                   // 圆心 Y = 右下角
  const R_OUTER = 260;             // 外圈半径
  const R_INNER = 170;             // 内圈半径
  const R_MID = (R_OUTER + R_INNER) / 2;  // 分界线半径 = 215

  /* ---------- 拨盘最大值 ---------- */
  const MAX_MIN = 60;             // 外圈最大分钟数
  const MAX_SEC = 60;             // 内圈最大秒数

  /* ---------- 状态 ---------- */
  let setMin = 25;                // 设定分钟
  let setSec = 0;                 // 设定秒钟
  let remainingSec = setMin * 60 + setSec;  // 剩余秒数
  let isRunning = false;          // 是否正在倒计时
  let isDragging = false;         // 是否正在拖拽
  let activeDial = null;          // 当前激活拨盘: 'outer' | 'inner'
  let activeDialRef = activeDial; // 闭包引用
  let timerId = null;             // setInterval ID
  let cycleCount = 1;             // 当前番茄计数

  /* ---------- 专注度检测状态 ---------- */
  let focusEnabled = false;
  let focusStartTime = null;
  let lastKeystrokeTime = Date.now();
  let keystrokeCount = 0;
  let visibleSince = Date.now();
  let focusHistory = [];
  let focusTimerId = null;

  /* ---------- DOM 引用 ---------- */
  const panel = document.getElementById('dialPanel');
  const svg = document.getElementById('dialSvg');
  const trackOuter = document.getElementById('trackOuter');
  const progressOuter = document.getElementById('progressOuter');
  const knobOuter = document.getElementById('knobOuter');
  const trackInner = document.getElementById('trackInner');
  const progressInner = document.getElementById('progressInner');
  const knobInner = document.getElementById('knobInner');
  const dialTicks = document.getElementById('dialTicks');
  const dialMin = document.getElementById('dialMin');
  const dialSec = document.getElementById('dialSec');
  const dialStatus = document.getElementById('dialStatus');
  const labelOuter = document.querySelector('.dial-label-outer');
  const labelInner = document.querySelector('.dial-label-inner');
  const btnStart = document.getElementById('btnStart');
  const btnReset = document.getElementById('btnReset');
  const btnStartText = btnStart.querySelector('span');
  const statusMode = document.querySelector('[data-status="mode"]');
  const statusCycle = document.querySelector('[data-status="cycle"]');
  const statusFocus = document.querySelector('[data-status="focus"]');
  const focusToggle = document.getElementById('focusToggle');
  const focusCard = document.getElementById('focusCard');
  const focusScore = document.getElementById('focusScore');
  const focusVisible = document.getElementById('focusVisible');
  const focusKeystroke = document.getElementById('focusKeystroke');
  const focusDuration = document.getElementById('focusDuration');

  /* ============================================================
      SVG 弧线路径计算
      从右侧 (VB, VB-R) 到下方 (VB-R, VB) 的四分之一圆弧
     ============================================================ */
  function arcPath(radius) {
    const sx = CX;          // 起始 X = 圆心 X (右侧)
    const sy = CY - radius; // 起始 Y = 圆心 Y - 半径
    const ex = CX - radius; // 结束 X = 圆心 X - 半径
    const ey = CY;          // 结束 Y = 圆心 Y (下方)
    return `M ${sx},${sy} A ${radius},${radius} 0 0,0 ${ex},${ey}`;
  }

  /* ---------- 初始化 SVG 轨道 & 刻度 ---------- */
  function initSvg() {
    trackOuter.setAttribute('d', arcPath(R_OUTER));
    trackInner.setAttribute('d', arcPath(R_INNER));
    progressOuter.setAttribute('d', arcPath(R_OUTER));
    progressInner.setAttribute('d', arcPath(R_INNER));

    // 绘制刻度（每 10 分钟/秒一个刻度）
    let ticksHtml = '';
    for (let i = 0; i <= 6; i++) {
      const angle = (i / 6) * (Math.PI / 2); // 0 ~ pi/2
      // 外圈刻度
      const ox1 = CX - (R_OUTER - 18) * Math.sin(angle);
      const oy1 = CY - (R_OUTER - 18) * Math.cos(angle);
      const ox2 = CX - (R_OUTER - 8) * Math.sin(angle);
      const oy2 = CY - (R_OUTER - 8) * Math.cos(angle);
      // 标签位置
      const lx = CX - (R_OUTER - 30) * Math.sin(angle);
      const ly = CY - (R_OUTER - 30) * Math.cos(angle) + 3;
      const label = i * 10;
      if (label <= MAX_MIN) {
        ticksHtml += `<line x1="${ox1}" y1="${oy1}" x2="${ox2}" y2="${oy2}"/>`;
        if (label % 20 === 0) {
          ticksHtml += `<text x="${lx}" y="${ly}">${label}</text>`;
        }
      }
      // 内圈刻度
      const ix1 = CX - (R_INNER - 14) * Math.sin(angle);
      const iy1 = CY - (R_INNER - 14) * Math.cos(angle);
      const ix2 = CX - (R_INNER - 7) * Math.sin(angle);
      const iy2 = CY - (R_INNER - 7) * Math.cos(angle);
      if (label <= MAX_SEC) {
        ticksHtml += `<line x1="${ix1}" y1="${iy1}" x2="${ix2}" y2="${iy2}"/>`;
      }
    }
    dialTicks.innerHTML = ticksHtml;
  }

  /* ============================================================
      更新 SVG 弧形进度与 Knob 位置
     ============================================================ */
  function updateDialSvg() {
    // 弧长公式
    const arcLenOuter = (Math.PI * R_OUTER) / 2;
    const arcLenInner = (Math.PI * R_INNER) / 2;

    // 使用「设定值」决定弧长静止状态；若正在倒计时则用剩余时间
    const curMin = isRunning ? Math.floor(remainingSec / 60) : setMin;
    const curSec = isRunning ? remainingSec % 60 : setSec;

    // 进度比例
    const outerRatio = Math.min(1, curMin / MAX_MIN);
    const innerRatio = Math.min(1, curSec / MAX_SEC);

    // stroke-dashoffset 计算（从完整到空的递减）
    progressOuter.setAttribute('stroke-dasharray', arcLenOuter);
    progressOuter.setAttribute('stroke-dashoffset', arcLenOuter * (1 - outerRatio));
    progressInner.setAttribute('stroke-dasharray', arcLenInner);
    progressInner.setAttribute('stroke-dashoffset', arcLenInner * (1 - innerRatio));

    // Knob 位置
    const outerAngle = outerRatio * (Math.PI / 2);
    const innerAngle = innerRatio * (Math.PI / 2);
    knobOuter.setAttribute('cx', CX - R_OUTER * Math.sin(outerAngle));
    knobOuter.setAttribute('cy', CY - R_OUTER * Math.cos(outerAngle));
    knobInner.setAttribute('cx', CX - R_INNER * Math.sin(innerAngle));
    knobInner.setAttribute('cy', CY - R_INNER * Math.cos(innerAngle));

    // 激活状态下的 Knob 放大
    progressOuter.setAttribute('stroke-width', activeDial === 'outer' ? 18 : 14);
    knobOuter.setAttribute('r', activeDial === 'outer' ? 13 : 10);
    progressInner.setAttribute('stroke-width', activeDial === 'inner' ? 15 : 11);
    knobInner.setAttribute('r', activeDial === 'inner' ? 11 : 8);

    // 过渡样式
    const transMode = isRunning
      ? 'stroke-dashoffset 1s linear'
      : activeDial
        ? 'none'
        : 'stroke-dashoffset 0.12s ease-out';
    progressOuter.style.transition = transMode;
    progressInner.style.transition = transMode;
    knobOuter.style.transition = isRunning ? 'cx 1s linear, cy 1s linear' : 'none';
    knobInner.style.transition = isRunning ? 'cx 1s linear, cy 1s linear' : 'none';

    // 更新文字
    dialMin.textContent = String(curMin).padStart(2, '0');
    dialSec.textContent = String(curSec).padStart(2, '0');

    // 标签高亮
    labelOuter.classList.toggle('is-active', activeDial === 'outer');
    labelInner.classList.toggle('is-active', activeDial === 'inner');
  }

  /* ============================================================
      极坐标拖拽 —— atan2 计算
     ============================================================ */
  function pointerToValue(e, dialType) {
    const rect = panel.getBoundingClientRect();
    const scaleX = VB / rect.width;   // viewBox → 实际像素缩放
    const scaleY = VB / rect.height;

    // 实际像素中的圆心位置 = rect 右下角
    const pxCenterX = rect.right;
    const pyCenterY = rect.bottom;

    const dx = e.clientX - pxCenterX;
    const dy = e.clientY - pyCenterY;

    // atan2 原始弧度 [-π, π]
    const rawRad = Math.atan2(dy, dx);

    // 映射到 [0, π/2]
    let mappedRad = -rawRad - Math.PI / 2;
    mappedRad = Math.max(0, Math.min(Math.PI / 2, mappedRad));

    // 转为数值
    const maxVal = dialType === 'outer' ? MAX_MIN : MAX_SEC;
    return Math.round((mappedRad / (Math.PI / 2)) * maxVal);
  }

  /* ---------- 拖拽事件处理 ---------- */
  function onPointerDown(e) {
    if (e.target.closest('button')) return; // 排除按钮

    const rect = panel.getBoundingClientRect();
    const dx = e.clientX - rect.right;
    const dy = e.clientY - rect.bottom;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 仅在四分之一圆区域内响应
    if (distance > R_OUTER * (rect.width / VB) + 20) return;

    // 激活拨盘判定
    activeDial = distance >= R_MID * (rect.width / VB) ? 'outer' : 'inner';
    activeDialRef = activeDial;
    isDragging = true;
    panel.classList.add('is-dragging');

    // 拖拽时暂停并捕获指针
    pauseTimer();
    panel.setPointerCapture(e.pointerId);

    updateDialFromPointer(e);
  }

  function onPointerMove(e) {
    if (!isDragging || !activeDialRef) return;
    updateDialFromPointer(e);
  }

  function onPointerUp(e) {
    if (isDragging) {
      isDragging = false;
      activeDial = null;
      activeDialRef = null;
      panel.classList.remove('is-dragging');
      panel.releasePointerCapture(e.pointerId);
    }
  }

  function updateDialFromPointer(e) {
    const val = pointerToValue(e, activeDialRef);
    pauseTimer();

    if (activeDialRef === 'outer') {
      setMin = val;
      remainingSec = val * 60 + setSec;
    } else {
      setSec = val;
      remainingSec = setMin * 60 + val;
    }
    updateDialSvg();
    updateStatusUI();
  }

  /* ============================================================
      倒计时逻辑
     ============================================================ */
  function startTimer() {
    if (remainingSec <= 0) return;
    isRunning = true;
    updateDialSvg();
    updateStatusUI();

    timerId = setInterval(() => {
      remainingSec--;
      if (remainingSec <= 0) {
        remainingSec = 0;
        onTimerComplete();
      }
      updateDialSvg();
    }, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    if (timerId) { clearInterval(timerId); timerId = null; }
    updateStatusUI();
  }

  function onTimerComplete() {
    pauseTimer();
    cycleCount++;
    // 恢复设定时间
    remainingSec = setMin * 60 + setSec;
    updateDialSvg();
    updateStatusUI();

    // 闪烁提示
    dialMin.parentElement.classList.add('is-done');
    setTimeout(() => dialMin.parentElement.classList.remove('is-done'), 6000);

    // 尝试通知
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('番茄钟完成！', {
        body: `专注了 ${setMin} 分 ${setSec} 秒，休息一下吧`,
      });
    }
  }

  function resetTimer() {
    pauseTimer();
    remainingSec = setMin * 60 + setSec;
    updateDialSvg();
    updateStatusUI();
    dialMin.parentElement.classList.remove('is-done');
  }

  function togglePlay() {
    if (remainingSec <= 0) {
      resetTimer();
      return;
    }
    if (isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  }

  /* ---------- UI 状态同步 ---------- */
  function updateStatusUI() {
    // 状态文字
    if (remainingSec === 0) {
      dialStatus.textContent = 'TIME EXPIRED';
      dialStatus.className = 'dial-status is-done';
      statusMode.textContent = '已完成';
    } else if (isRunning) {
      dialStatus.textContent = 'COUNTDOWN RUNNING';
      dialStatus.className = 'dial-status is-running';
      statusMode.textContent = '倒计时中';
    } else {
      dialStatus.textContent = 'SET TIMER';
      dialStatus.className = 'dial-status';
      statusMode.textContent = '已暂停';
    }

    // 按钮文字
    btnStartText.textContent = isRunning ? '暂停' : (remainingSec === 0 ? '完成' : '开始');
    btnStart.classList.toggle('is-paused', isRunning);

    // 番茄计数
    statusCycle.textContent = `第 ${cycleCount} 个番茄`;
  }

  /* ============================================================
      专注度检测（基于浏览器可用 API）
     ============================================================ */
  function enableFocusDetection() {
    focusEnabled = true;
    focusStartTime = Date.now();
    lastKeystrokeTime = Date.now();
    keystrokeCount = 0;
    visibleSince = Date.now();
    focusHistory = [];

    focusToggle.classList.add('is-active');
    focusCard.hidden = false;
    statusFocus.textContent = '检测中';

    // 事件监听
    document.addEventListener('keydown', onUserActivity);
    document.addEventListener('mousemove', onUserActivityThrottled);
    document.addEventListener('click', onUserActivity);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 每秒计算专注度
    focusTimerId = setInterval(calculateFocus, 1000);

    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function disableFocusDetection() {
    focusEnabled = false;
    focusToggle.classList.remove('is-active');
    focusCard.hidden = true;
    statusFocus.textContent = '检测关闭';

    document.removeEventListener('keydown', onUserActivity);
    document.removeEventListener('mousemove', onUserActivityThrottled);
    document.removeEventListener('click', onUserActivity);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    if (focusTimerId) { clearInterval(focusTimerId); focusTimerId = null; }
  }

  function onUserActivity() {
    if (!focusEnabled) return;
    lastKeystrokeTime = Date.now();
    keystrokeCount++;
  }

  function onVisibilityChange() {
    if (!focusEnabled) return;
    if (document.hidden) {
      visibleSince = -1; // 标记为不可见
    } else {
      visibleSince = Date.now();
    }
  }

  // 节流版 mousemove（避免事件过多）
  let _lastMouseMove = 0;
  function onUserActivityThrottled() {
    const now = Date.now();
    if (now - _lastMouseMove > 200) {
      _lastMouseMove = now;
      onUserActivity();
    }
  }

  function calculateFocus() {
    if (!focusEnabled) return;

    const now = Date.now();
    const totalElapsed = (now - (focusStartTime || now)) / 1000; // 秒

    // 标签可见度 (0~1)
    let visibility = document.hidden ? 0 : 1;

    // 键盘活跃度: 最近 30 秒内有输入 = 活跃
    const idleMs = now - lastKeystrokeTime;
    const isActive = idleMs < 30000;

    // 综合分数 (简单算法)
    let score = 0;
    if (document.hidden) {
      score = 0;           // 切到别的标签 = 完全不专注
    } else if (idleMs > 60000) {
      score = 40;          // 超过 1 分钟无操作
    } else if (idleMs > 30000) {
      score = 70;          // 30~60 秒无操作
    } else {
      score = 95;          // 活跃操作
    }

    // 记录历史
    focusHistory.push({ time: now, score });
    if (focusHistory.length > 3600) focusHistory.shift(); // 保留 1 小时

    // 持续时长（mm:ss）
    const durMin = Math.floor(totalElapsed / 60);
    const durSec = Math.floor(totalElapsed % 60);
    const durStr = `${String(durMin).padStart(2, '0')}:${String(durSec).padStart(2, '0')}`;

    // 更新 UI
    focusScore.textContent = score;
    focusScore.style.color = score >= 80 ? 'var(--pomo-secondary-light)'
      : score >= 50 ? 'var(--pomo-primary)' : 'var(--pomo-primary-dark)';

    focusVisible.textContent = document.hidden ? '隐藏中' : '可见';
    focusVisible.className = 'focus-metric-val ' + (document.hidden ? 'is-warn' : 'is-good');

    focusKeystroke.textContent = isActive ? '活跃' : idleMs > 60000 ? '静止' : '间歇';
    focusKeystroke.className = 'focus-metric-val ' + (isActive ? 'is-good' : 'is-warn');

    focusDuration.textContent = durStr;
  }

  /* ============================================================
      初始化与事件绑定
     ============================================================ */
  function bindEvents() {
    // 拨盘拖拽
    panel.addEventListener('pointerdown', onPointerDown);
    panel.addEventListener('pointermove', onPointerMove);
    panel.addEventListener('pointerup', onPointerUp);
    panel.addEventListener('pointercancel', onPointerUp);

    // 按钮
    btnStart.addEventListener('click', togglePlay);
    btnReset.addEventListener('click', resetTimer);

    // 专注度开关
    focusToggle.addEventListener('click', () => {
      if (focusEnabled) disableFocusDetection();
      else enableFocusDetection();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) resetTimer();
    });
  }

  // 启动
  initSvg();
  updateDialSvg();
  updateStatusUI();
  bindEvents();
})();
