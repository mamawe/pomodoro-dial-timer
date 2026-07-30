/* ============================================================
   constants.js —— 8 张系数表
   ⚠️ “唯一允许拍脑袋的地方”；每个值均标注来源，便于后续校准
   定位估算，工程精估；非 Radiance 级仿真
   ============================================================ */

/* ---------- 1. 天空垂直面照度（水平面当量）Lux ----------
   来源：CIE 全阴天 / Perez 晴天 典型取值 × 季节修正
   说明：阴天取低、晴夏取高；±30% 可接受 */
export const SKY_LUX = {
  // 键顺序: <天气>_<季节>
  sunny_summer: 100000,  sunny_spring: 80000,  sunny_autumn: 75000,  sunny_winter: 45000,
  cloudy_summer: 30000, cloudy_spring: 24000, cloudy_autumn: 22000, cloudy_winter: 13000,
  overcast_all: 10000,   // 阴天季节差异很小，统一取值
};

/* ---------- 2. 朝向直射系数 ----------
   来源：考虑朝向与太阳方位的简化匹配；晴天才启用，阴天=0
   0 = 该时段该朝向无直射；>0 = 有直射（值越大越正对太阳） */
export const ORIENT_DIRECT = {
  //         上午  中午  下午
  S:  [0.3,  1.0,  0.3],   // 正南：中午最强
  SE: [0.9,  0.5,  0.0],   // 东南：上午最强
  SW: [0.0,  0.5,  0.9],   // 西南：下午最强
  E:  [0.8,  0.1,  0.0],   // 正东：仅上午
  W:  [0.0,  0.1,  0.8],   // 正西：仅下午
  N:  [0.0,  0.0,  0.0],   // 正北：我国低纬度地区基本无直射
};

/* ---------- 3. 直射光斑进深 m（太阳高度相关）----------
   来源：太阳高度角的季节特征简化 */
export const PATCH_DEPTH = {
  summer: 1.5, spring: 2.5, autumn: 2.5, winter: 4.0,
};

/* ---------- 4. 玻璃透光率 ---------- */
export const GLASS_TAU = {
  clear: 0.75,   // 普通透明
  lowe:  0.55,   // Low-E 镀膜（会降低透光）
  ultra: 0.88,   // 超白玻
};

/* ---------- 5. 窗框遮挡率 ---------- */
export const FRAME_FACTOR = {
  plastic: 0.70,   // 塑钢，框较窄
  thermal: 0.60,   // 断桥铝，框材较宽遮挡略多
};

/* ---------- 6. 深度衰减 β（距离窗越远衰减越快）----------
   来源：平方反比近似的经验拟合 */
export const DECAY_BETA = {
  S: 0.4, SE: 0.6, E: 0.6, SW: 0.6, W: 0.6, N: 0.8,
};

/* ---------- 7. 树种参数 ----------
   来源：园林统计的近似值；落叶乔木冬季大幅降低，常绿全年高
   默认冠幅 m 仅供滑块初始化参考 */
export const TREE_SPECIES = {
  wutong:    { label: '梧桐',   summerK: 0.55, winterK: 0.18, defaultCrown: 7,  evergreen: false },
  yinxing:   { label: '银杏',   summerK: 0.50, winterK: 0.15, defaultCrown: 6,  evergreen: false },
  guohuai:   { label: '国槐',   summerK: 0.50, winterK: 0.15, defaultCrown: 6,  evergreen: false },
  baila:     { label: '白蜡',   summerK: 0.50, winterK: 0.15, defaultCrown: 6,  evergreen: false },
  xiangzhang:{ label: '香樟(常绿)', summerK: 0.60, winterK: 0.60, defaultCrown: 8, evergreen: true  },
};

/* ---------- 8. 年度天气权重 ----------
   来源：我国东部季风区典型城市全年多云/晴/阴天数比粗估 */
export const ANNUAL_WEIGHT = {
  sunny:   0.40,
  cloudy:  0.35,
  overcast: 0.25,
};

/* ---------- 9. 判断阈值 Lux ----------
   参考：GB 50033 建筑采光设计标准 + LEED v4 粗估 */
export const THRESHOLD = {
  weak: 150,        // 弱光线下限
  comfort: 300,     // 舒适采光照度建议值（工作/阅读）
  strongOK: 600,    // 强但可接受
  glare: 10000,     // 可能触发暴晒风险
};
