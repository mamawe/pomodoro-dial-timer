/* ============================================================
   engine/index.js —— 真实物理估算引擎（第 1 版）

   方法：简化 Daylight Factor（DF）+ 太阳直射分量 + Beer-Lambert 树遮蔽
   参考：
     - CIE Overcast Sky / Perez All-Weather 天空亮度分布
     - BRS Daylight Factor（Split-flux 简化）
     - 中国中部典型纬度（~32°N）太阳位置参数化
   
   输入：
     input    = { width, depth, windowWidth, orientation, glass, frame,
                  hasTree, treeSpecies, treeFloor, crownWidth }
     scenario = { season, weather, slot }
   输出：
     computeGrid   → { cols, rows, step, stats }
     computeAnnual → { goodLight, overexpose, subtitle, risk, tip }
   ============================================================ */

import {
  SKY_LUX, GLASS_TAU, FRAME_FACTOR,
  DECAY_BETA, TREE_SPECIES, ANNUAL_WEIGHT, THRESHOLD,
} from '../constants.js';

/* ============================================================
   A. 太阳位置参数化（简化）
   中国中部约 32°N，取"典型日"二分二至；
   方位角：南=180°, 东=90°, 西=270°, 北=0°

   ⚠️ 太阳位置是绝对的，不随窗朝向改变
      ——北半球正午太阳永远偏南，北向窗全年无直射
   ============================================================ */
const ORIENT_AZIMUTH = { N: 0, E: 90, S: 180, W: 270, SE: 135, SW: 225 };

// 正午太阳高度角（夏至最高，冬至最低）
const NOON_ALTITUDE = { summer: 78, spring: 60, autumn: 55, winter: 35 };
// 上午/下午高度角（明显低于正午）
const OFFNOON_ALT   = { summer: 32, spring: 27, autumn: 26, winter: 17 };

// 太阳绝对方位角（正南=180°；上午偏东，下午偏西）
const SUN_AZIMUTH = {
  morning:   115,   // 上午：东-东南
  noon:      180,   // 正午：正南
  afternoon: 245,   // 下午：西-西南
};

/* ============================================================
   B. 外部照度条件表
   E_dhi    = 水平面天空散射照度 lux（阴天较高，晴天较低）
   E_dn     = 法向直射照度 lux（仅晴/多云；阴天 ~0）
   来源：CIE 典型天空 + 中国中部 TMY 统计，简化取中值
   ============================================================ */
const DIFFUSE_H = {
  sunny_summer:  25000,  sunny_spring:  22000,  sunny_autumn:  20000,  sunny_winter:  15000,
  cloudy_summer: 32000,  cloudy_spring:  27000,  cloudy_autumn:  25000,  cloudy_winter:  20000,
  overcast_all:  18000,
};
const DIRECT_N = {
  sunny_summer:  95000,  sunny_spring:  75000,  sunny_autumn:  68000,  sunny_winter:  45000,
  cloudy_summer: 30000,  cloudy_spring:  20000,  cloudy_autumn:  18000,  cloudy_winter:  10000,
  overcast_all:  0,
};

function getDiffuse(weather, season) {
  if (weather === 'overcast') return DIFFUSE_H.overcast_all;
  return DIFFUSE_H[`${weather}_${season}`];
}
function getDirect(weather, season) {
  if (weather === 'overcast') return DIRECT_N.overcast_all;
  return DIRECT_N[`${weather}_${season}`];
}

/* ============================================================
   C. 树木 Beer-Lambert 遮挡
   treeF = 1 − k · coverage
   coverage = min(1, 冠幅 / 窗宽)
   落叶：夏高冬低；常绿：全年高
   ============================================================ */
function treeFactor(input, season) {
  if (!input.hasTree) return 1;
  if (input.treeFloor < input.floor) return 1;        // 树冠够不到客厅
  const sp = TREE_SPECIES[input.treeSpecies];
  if (!sp) return 1;
  const k = (season === 'winter' && !sp.evergreen) ? sp.winterK
          : (season === 'summer')                 ? sp.summerK
          : (sp.summerK + sp.winterK) * 0.5;
  const cov = Math.min(1.2, input.crownWidth / Math.max(0.5, input.windowWidth));
  return Math.max(0.05, 1 - k * cov);
}

/* ============================================================
   D. 工具
   ============================================================ */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const deg2rad = (deg) => deg * Math.PI / 180;

/* ============================================================
   E. 单场景网格计算
   ============================================================ */
export function computeGrid(input, scenario) {
  const step  = 0.25;
  const width = clamp(input.width, 2.5, 6);
  const depth = clamp(input.depth, 2.5, 8);
  const winW  = clamp(input.windowWidth, 0.8, 4);
  const winH  = 1.5;                                  // 窗户高度（固定）
  const cols  = Math.max(8, Math.round(width / step));
  const rows  = Math.max(8, Math.round(depth / step));

  const values = new Float32Array(cols * rows);

  // ---- 外部照度 + 材料参数 ----
  const E_dhi    = getDiffuse(scenario.weather, scenario.season);
  const E_dn     = getDirect(scenario.weather, scenario.season);
  const tauGlass = GLASS_TAU[input.glass];
  const tauFrame = FRAME_FACTOR[input.frame];
  const tau      = tauGlass * tauFrame;               // 综合透射率
  const beta     = DECAY_BETA[input.orientation];      // 深度衰减
  const tf       = treeFactor(input, scenario.season);

  // ---- 近窗 DF 基准 ----
  const A_floor = width * depth;
  const DF0     = 0.55 * tau * (winW * winH) / A_floor;

  // ---- 太阳位置与入射角 ----
  // 太阳位置是绝对的（正午正南），与窗朝向无关；入射角由 太阳-窗法线 夹角决定
  const slot2idx   = { morning: 0, noon: 1, afternoon: 2 }[scenario.slot];
  const useAltDeg  = (slot2idx === 1) ? NOON_ALTITUDE[scenario.season] : OFFNOON_ALT[scenario.season];
  const altRad     = deg2rad(useAltDeg);
  const winAzRad   = deg2rad(ORIENT_AZIMUTH[input.orientation]);
  const sunAzRad   = deg2rad(SUN_AZIMUTH[scenario.slot]);

  // 铅直窗入射角余弦: cos(θ) = cos(alt)·cos(sunAz − winAz)
  //   → 北向窗正午 Δaz = 180°, cos(180°) = -1 → cosInc < 0 → 全年无直射（正确）
  const cosInc     = Math.cos(altRad) * Math.cos(sunAzRad - winAzRad);
  const hasDirect  = E_dn > 0 && cosInc > 0;

  const patchDepth = winH / Math.tan(altRad);   // 光斑最大进深

  // ---- 逐点计算 ----
  let sum = 0, max = 0, comfortCount = 0, overCount = 0;
  const total = cols * rows;

  for (let r = 0; r < rows; r++) {
    const x = r * step;                           // 深度
    for (let c = 0; c < cols; c++) {
      const lateral = 1 - 0.5 * Math.abs((c / (cols - 1)) - 0.5);
      const decay   = 1 / (1 + beta * Math.pow(x / winH, 2));
      const DF      = DF0 * decay * lateral;

      // 散射分量（始终存在）
      const diffuse = E_dhi * DF;

      // 直射分量（仅太阳正对窗且在光斑内）
      let direct = 0;
      if (hasDirect && x <= patchDepth) {
        const patchDecay = 1 / (1 + 0.5 * Math.pow(x / winH, 2));
        direct = E_dn * tau * cosInc * patchDecay * lateral;
      }

      const E = (diffuse + direct) * tf;
      values[r * cols + c] = E;

      sum += E;
      if (E > max) max = E;
      if (E >= THRESHOLD.comfort && E <= THRESHOLD.glare) comfortCount++;
      if (E > THRESHOLD.glare) overCount++;
    }
  }

  return {
    cols, rows, step,
    stats: Object.freeze({
      mean:          sum / total,
      max,
      comfortRatio:  comfortCount / total,
      overexposeCount: overCount,
      overexposeRatio: overCount / total,
      values,
    }),
  };
}

/* ============================================================
   F. 年度 sDA / ASE 粗估
   遍历 4 季节 × 3 天气 × 3 时段 = 36 微场景，按天气频率加权
   goodLight  = 室内 ≥50% 面积照度 ≥ 300 lux 的时间占比（sDA 近似）
   overexpose = 室内 ≥10% 面积照度 > 10000 lux（暴晒）的时间占比（ASE 近似）
   ============================================================ */
export function computeAnnual(input) {
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  const weathers = ['sunny', 'cloudy', 'overcast'];
  const slots   = ['morning', 'noon', 'afternoon'];

  let goodWeight = 0, overWeight = 0, totalWeight = 0;

  for (const s of seasons) {
    for (const w of weathers) {
      const wt = (ANNUAL_WEIGHT[w] / 3) * 0.25;   // 天气权重 × 时段权重 × 季节权重
      for (const sl of slots) {
        const grid = computeGrid(input, { season: s, weather: w, slot: sl });
        totalWeight += wt;
        if (grid.stats.comfortRatio >= 0.5)        goodWeight += wt;   // ≥50% 面积达标
        if (grid.stats.overexposeRatio > 0.10)     overWeight += wt;    // ≥10% 面积暴晒
      }
    }
  }

  const goodLight  = clamp(Math.round((goodWeight / totalWeight) * 100), 0, 99);
  const overexpose = clamp(Math.round((overWeight / totalWeight) * 100), 0, 40);

  // ---- 文案生成 ----
  let subtitle, risk, tip;

  if (goodLight >= 80)      subtitle = '客厅采光充足，多数状态下白天无需开灯';
  else if (goodLight >= 60) subtitle = '客厅采光中等，部分区域需补光';
  else                      subtitle = '客厅整体偏暗，建议增加辅助照明或扩大窗户';

  // 朝向与风险组合文案
  const o = input.orientation;
  const westish = (o === 'W' || o === 'SW' || o === 'NW');
  const northly = (o === 'N' || o === 'NW' || o === 'NE');
  const southly = (o === 'S' || o === 'SE' || o === 'SW');

  if (overexpose >= 15) {
    risk = '部分时段直射强烈，可能带来眩光与局部过热，建议加浅色遮光帘';
    tip  = '推荐浅色遮光帘：冬季收帘保持透光，夏季放帘阻隔强光';
  } else if (overexpose >= 6) {
    risk = '正午前后可能出现短时强光，敏感区域建议预留遮光措施';
    tip  = '百叶帘或调光膜可精细控制进光量';
  } else if (westish) {
    risk = '西向户型午后易受西晒影响，夏季高温与眩光需关注';
    tip  = '西侧窗户建议贴隔热玻璃膜或装外遮阳百叶';
  } else if (northly) {
    risk = '北向户型直射光极少，室内以散射光为主，明亮但偏冷色调';
    tip  = '搭配暖色人工照明可提升冬季体感舒适度';
  } else if (southly && goodLight >= 75) {
    risk = '未识别到明显暴晒风险，全年光照分布较为均衡';
    tip  = '当前朝向采光优良，可按装饰需求选配窗帘';
  } else {
    risk = '未识别到明显暴晒风险';
    tip  = '继续保持当前采光条件即可';
  }

  // 树木修正补充
  if (input.hasTree) {
    const sp = TREE_SPECIES[input.treeSpecies];
    tip += sp?.evergreen
      ? `；${sp.label}为常绿树种，全年对窗外遮蔽较稳定`
      : `；窗外${sp?.label ?? '落叶树'}夏季遮阳明显、冬季透光较好`;
  }

  return { goodLight, overexpose, subtitle, risk, tip };
}
