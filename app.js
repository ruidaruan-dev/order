/* ============================================================
   订单进度台 — 应用逻辑
   双模块：试制（myexcel 工序流）/ 量产（SAP 055 交付流）
   依据：CONTEXT.md 共识
   ============================================================ */

/* ----------------------------------------------------------
   1. 工序 / 交付 节点定义
   ---------------------------------------------------------- */

// 试制工序流：开单 → 色粉计量 → 混料 → 挤出 → 注塑色板 → 注塑样条 → 最终班长完成 → 排产
const PILOT_STEPS = [
  { key: 'create',          label: '开单' },
  { key: 'color_powder',    label: '色粉计量' },
  { key: 'mixing',          label: '混料' },
  { key: 'extrusion',       label: '挤出' },
  { key: 'inj_color',       label: '注塑色板' },
  { key: 'inj_strip',       label: '注塑样条' },
  { key: 'final_monitor',   label: '最终班长完成' },
  { key: 'scheduling',      label: '排产' },
];

// 量产交付流：创建 → 预计交期 → 发货(过账) → 在途 → 签收(按期)
const MASS_STEPS = [
  { key: 'create',  label: '订单创建' },
  { key: 'due',     label: '预计交期' },
  { key: 'ship',    label: '已发货' },
  { key: 'transit', label: '在途' },
  { key: 'done',    label: '签收' },
];

/* ----------------------------------------------------------
   2. Mock 数据（试制 4 类 + 量产 + 业务员归属映射）
   ---------------------------------------------------------- */

// 试制订单（4 类合并，字段结构统一）
// step 含 time/person/exception；未发生节点无 time
const PILOT_ORDERS = [
  {
    type: 'gz', orderNo: '12482359', base: '广州', machine: '挤出机 G-03', orderCount: 120,
    customer: '宁德时代', product: '阻燃 PP 板材',
    steps: {
      create:        { time: '2026-07-21 09:12', person: '王武龙' },
      color_powder:  { time: '2026-07-21 14:30', person: '丘文彬' },
      mixing:        { time: '2026-07-22 08:45', person: '邹华明' },
      extrusion:     { time: '2026-07-22 15:20', person: '邹华明', exception: '表面有轻微条纹，已返工' },
      inj_color:     { time: '2026-07-23 10:05', person: '刘富贵' },
      inj_strip:     { time: null },
      final_monitor: { time: null },
      scheduling:    { time: null },
    },
  },
  {
    type: 'gz', orderNo: '12483102', base: '广州', machine: '注塑机 Z-12', orderCount: 60,
    customer: '比亚迪', product: '电池包上盖样件',
    steps: {
      create:        { time: '2026-07-25 10:30', person: '王武龙' },
      color_powder:  { time: '2026-07-25 16:10', person: '丘文彬' },
      mixing:        { time: '2026-07-26 09:00', person: '邹华明' },
      extrusion:     { time: '2026-07-26 14:22', person: '邹华明' },
      inj_color:     { time: '2026-07-27 11:40', person: '刘富贵' },
      inj_strip:     { time: '2026-07-28 09:15', person: '杨文超' },
      final_monitor: { time: '2026-07-28 16:00', person: '邹华明' },
      scheduling:    { time: '2026-07-29 08:30', person: '杨东东' },
    },
  },
  {
    type: 'sh', orderNo: 'SH20260728-44', base: '上海', machine: '挤出机 S-07', orderCount: 200,
    customer: '华为终端', product: 'PC/ABS 合金外壳',
    steps: {
      create:        { time: '2026-07-28 11:00', person: '袁刚' },
      color_powder:  { time: '2026-07-28 15:45', person: '袁刚' },
      mixing:        { time: '2026-07-29 08:30', person: '彭江苇' },
      extrusion:     { time: null, exception: '原料含水率偏高，待复检' },
      inj_color:     { time: null },
      inj_strip:     { time: null },
      final_monitor: { time: null },
      scheduling:    { time: null },
    },
  },
  {
    type: 'sh', orderNo: 'SH20260730-19', base: '上海', machine: '注塑机 S-21', orderCount: 45,
    customer: '小米通讯', product: '中框样条',
    steps: {
      create:        { time: '2026-07-30 09:20', person: '袁刚' },
      color_powder:  { time: '2026-07-30 13:50', person: '袁刚' },
      mixing:        { time: '2026-07-30 17:10', person: '彭江苇' },
      extrusion:     { time: '2026-07-31 08:40', person: '彭江苇' },
      inj_color:     { time: null },
      inj_strip:     { time: null },
      final_monitor: { time: null },
      scheduling:    { time: null },
    },
  },
  {
    type: 'xs', orderNo: 'EX20260801-206', base: '广州', machine: '小试线 X-02', orderCount: 15,
    customer: '联想集团', product: '回收料配方筛选',
    steps: {
      create:        { time: '2026-08-01 10:00', person: '研发-李工' },
      color_powder:  { time: '2026-08-01 11:30', person: '丘文彬' },
      mixing:        { time: '2026-08-01 14:00', person: '邹华明' },
      extrusion:     { time: '2026-08-01 16:20', person: '邹华明' },
      inj_color:     { time: null },
      inj_strip:     { time: null },
      final_monitor: { time: null },
      scheduling:    { time: null },
    },
  },
  {
    type: 'xs', orderNo: 'EX20260802-318', base: '上海', machine: '小试线 X-05', orderCount: 8,
    customer: 'OPPO', product: '新型色粉比对',
    steps: {
      create:        { time: '2026-08-02 09:15', person: '研发-周工' },
      color_powder:  { time: '2026-08-02 10:40', person: '袁刚' },
      mixing:        { time: '2026-08-02 13:05', person: '彭江苇' },
      extrusion:     { time: '2026-08-02 15:30', person: '彭江苇' },
      inj_color:     { time: '2026-08-02 17:45', person: '杨建洲' },
      inj_strip:     { time: '2026-08-03 09:10', person: '杨建洲', exception: '样条拉伸偏低，需补做' },
      final_monitor: { time: null },
      scheduling:    { time: null },
    },
  },
  {
    type: 'oa', orderNo: 'OA20260801-07', base: '广州', machine: '注塑机 Z-08', orderCount: 30,
    customer: '内部研发', product: 'OA 辅助打样-结构验证',
    steps: {
      create:        { time: '2026-08-01 14:00', person: 'OA-系统' },
      color_powder:  { time: null },
      mixing:        { time: null },
      extrusion:     { time: null },
      inj_color:     { time: null },
      inj_strip:     { time: null },
      final_monitor: { time: null },
      scheduling:    { time: '2026-08-01 16:00', person: '杨东东' },
    },
  },
  {
    type: 'oa', orderNo: 'OA20260802-12', base: '上海', machine: '注塑机 S-19', orderCount: 20,
    customer: '内部研发', product: 'OA 辅助打样-配色复核',
    steps: {
      create:        { time: '2026-08-02 10:30', person: 'OA-系统' },
      color_powder:  { time: null },
      mixing:        { time: null },
      extrusion:     { time: null },
      inj_color:     { time: null },
      inj_strip:     { time: '2026-08-03 11:20', person: '杨建洲' },
      final_monitor: { time: null },
      scheduling:    { time: '2026-08-02 14:00', person: '彭江苇' },
    },
  },
];

// 量产订单（SAP 055 交付流）
// onTime: '是' | '否' | '在途' | '待发货' | '逾期未发'
const MASS_ORDERS = [
  {
    orderNo: 'SO-4400218731', deliveryNo: 'DL-88012934', shipNo: 'SF-22901773', customerOrderNo: 'CUST-2026-7731',
    customer: '宁德时代', shipTo: '宁德时代-江苏基地', material: 'PP-FR-200', materialDesc: '阻燃 PP 板材',
    productLine: '阻燃工程塑料', plant: '广州工厂', region: '华东', city: '常州',
    createDate: '2026-07-10', firstDate: '2026-07-22', postDate: '2026-07-20', inTransitDays: 3, onTime: '是',
    qty: 12.5,
  },
  {
    orderNo: 'SO-4400219012', deliveryNo: 'DL-88013455', shipNo: 'SF-22904812', customerOrderNo: 'CUST-2026-7902',
    customer: '比亚迪', shipTo: '比亚迪-深圳坪山', material: 'PC-ABS-C90', materialDesc: '电池包上盖',
    productLine: '合金材料', plant: '广州工厂', region: '华南', city: '深圳',
    createDate: '2026-07-15', firstDate: '2026-07-26', postDate: '2026-07-28', inTransitDays: 2, onTime: '否',
    qty: 8.2,
  },
  {
    orderNo: 'SO-4400220115', deliveryNo: 'DL-88014012', shipNo: 'SF-22905601', customerOrderNo: 'CUST-2026-8110',
    customer: '华为终端', shipTo: '华为-东莞松山湖', material: 'PC-ABS-A15', materialDesc: 'PC/ABS 合金外壳',
    productLine: '合金材料', plant: '上海工厂', region: '华南', city: '东莞',
    createDate: '2026-07-20', firstDate: '2026-08-01', postDate: '2026-07-30', inTransitDays: 4, onTime: '是',
    qty: 5.6,
  },
  {
    orderNo: 'SO-4400220488', deliveryNo: null, shipNo: null, customerOrderNo: 'CUST-2026-8233',
    customer: '小米通讯', shipTo: '小米-北京亦庄', material: 'PA6-GF30', materialDesc: '中框材料',
    productLine: '尼龙系列', plant: '上海工厂', region: '华北', city: '北京',
    createDate: '2026-07-26', firstDate: '2026-08-05', postDate: null, inTransitDays: 0, onTime: '待发货',
    qty: 3.4,
  },
  {
    orderNo: 'SO-4400220520', deliveryNo: 'DL-88014560', shipNo: null, customerOrderNo: 'CUST-2026-8301',
    customer: '联想集团', shipTo: '联想-合肥联宝', material: 'PC-FR-110', materialDesc: '回收料配方',
    productLine: '回收再生', plant: '广州工厂', region: '华东', city: '合肥',
    createDate: '2026-07-28', firstDate: '2026-08-06', postDate: '2026-08-02', inTransitDays: 1, onTime: '在途',
    qty: 2.1,
  },
  {
    orderNo: 'SO-4400220601', deliveryNo: null, shipNo: null, customerOrderNo: 'CUST-2026-8388',
    customer: 'OPPO', shipTo: 'OPPO-东莞长安', material: 'PMMA-XT', materialDesc: '新型色粉材料',
    productLine: '光学材料', plant: '上海工厂', region: '华南', city: '东莞',
    createDate: '2026-07-30', firstDate: '2026-08-03', postDate: null, inTransitDays: 0, onTime: '逾期未发',
    qty: 1.8,
  },
  {
    orderNo: 'SO-4400220712', deliveryNo: 'DL-88015001', shipNo: 'SF-22906188', customerOrderNo: 'CUST-2026-8420',
    customer: '宁德时代', shipTo: '宁德时代-四川基地', material: 'PP-FR-200', materialDesc: '阻燃 PP 板材',
    productLine: '阻燃工程塑料', plant: '广州工厂', region: '西南', city: '宜宾',
    createDate: '2026-07-18', firstDate: '2026-07-30', postDate: '2026-07-29', inTransitDays: 5, onTime: '是',
    qty: 15.0,
  },
  {
    orderNo: 'SO-4400220833', deliveryNo: 'DL-88015342', shipNo: 'SF-22906770', customerOrderNo: 'CUST-2026-8551',
    customer: '比亚迪', shipTo: '比亚迪-西安基地', material: 'PA66-GF25', materialDesc: '结构件尼龙',
    productLine: '尼龙系列', plant: '上海工厂', region: '西北', city: '西安',
    createDate: '2026-07-22', firstDate: '2026-08-02', postDate: '2026-08-01', inTransitDays: 3, onTime: '是',
    qty: 6.8,
  },
  {
    orderNo: 'SO-4400220901', deliveryNo: null, shipNo: null, customerOrderNo: 'CUST-2026-8612',
    customer: '华为终端', shipTo: '华为-武汉研究所', material: 'PC-ABS-A15', materialDesc: 'PC/ABS 合金外壳',
    productLine: '合金材料', plant: '上海工厂', region: '华中', city: '武汉',
    createDate: '2026-08-01', firstDate: '2026-08-12', postDate: null, inTransitDays: 0, onTime: '待发货',
    qty: 4.3,
  },
  {
    orderNo: 'SO-4400220950', deliveryNo: 'DL-88015988', shipNo: null, customerOrderNo: 'CUST-2026-8701',
    customer: '小米通讯', shipTo: '小米-深圳仓储', material: 'PA6-GF30', materialDesc: '中框材料',
    productLine: '尼龙系列', plant: '广州工厂', region: '华南', city: '深圳',
    createDate: '2026-07-29', firstDate: '2026-08-07', postDate: '2026-08-03', inTransitDays: 2, onTime: '在途',
    qty: 7.2,
  },
];

// 业务员归属映射（RPA 定期生成的"订单-业务员"映射表）
// 每个业务员持有若干试制单 + 量产单
const OWNERS = {
  '张明 (ZM)': {
    pilot: ['12482359', 'SH20260728-44', 'EX20260801-206', 'OA20260801-07'],
    mass:  ['SO-4400218731', 'SO-4400220115', 'SO-4400220520', 'SO-4400220712', 'SO-4400220950'],
  },
  '李芳 (LF)': {
    pilot: ['12483102', 'SH20260730-19', 'EX20260802-318', 'OA20260802-12'],
    mass:  ['SO-4400219012', 'SO-4400220488', 'SO-4400220601', 'SO-4400220833', 'SO-4400220901'],
  },
};

/* ----------------------------------------------------------
   3. 全局状态
   ---------------------------------------------------------- */
const STATE = {
  currentUser: '张明 (ZM)',
  module: 'mass',              // 默认量产模块
  moduleOrder: ['mass', 'pilot'],
  search: '',
  pilotTypeFilter: 'all',      // all / xs / gz / sh / oa
  pilotOnlyException: false,
  massStatusFilter: 'all',     // all / ontime / late / transit / pending
  sortKey: { pilot: 'progress', mass: 'due' },
  sortDir: { pilot: 'asc', mass: 'asc' },
};

const TYPE_META = {
  xs: { label: '小试',     cls: 'tag--xs' },
  gz: { label: '中试·广州', cls: 'tag--gz' },
  sh: { label: '中试·上海', cls: 'tag--sh' },
  oa: { label: 'OA辅助',   cls: 'tag--oa' },
};

const STORAGE_KEY = 'order-dashboard::module-order';

/* ----------------------------------------------------------
   4. 工具函数
   ---------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

function loadModuleOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === 2) STATE.moduleOrder = saved;
  } catch (e) { /* 忽略，用默认 */ }
}
function saveModuleOrder() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE.moduleOrder));
}

// 计算试制单进度：当前工序、已完成数、是否异常
function pilotProgress(order) {
  let done = 0, activeIdx = -1, exception = null;
  for (let i = 0; i < PILOT_STEPS.length; i++) {
    const s = order.steps[PILOT_STEPS[i].key];
    if (s && s.time) {
      done++;
      if (s.exception) exception = { step: PILOT_STEPS[i].label, msg: s.exception };
    } else {
      if (activeIdx === -1) activeIdx = i;
    }
  }
  // 全部完成
  if (done === PILOT_STEPS.length) activeIdx = -2;
  const total = PILOT_STEPS.length;
  const currentLabel = activeIdx === -2
    ? '已完成'
    : (activeIdx === -1 ? '待开始' : PILOT_STEPS[activeIdx].label + '中');
  return { done, total, activeIdx, currentLabel, exception };
}

// 计算量产单交付进度
function massProgress(o) {
  // 步骤状态：done / active / pending
  const steps = MASS_STEPS.map(s => ({ ...s, status: 'pending', time: '', person: '' }));
  // 1. 创建
  steps[0].status = 'done'; steps[0].time = o.createDate;
  // 2. 预计交期
  steps[1].status = 'done'; steps[1].time = o.firstDate;
  // 3. 发货
  if (o.postDate) { steps[2].status = 'done'; steps[2].time = o.postDate; }
  else { steps[2].status = 'active'; }
  // 4. 在途
  if (o.postDate && o.inTransitDays > 0 && o.onTime !== '是' && o.onTime !== '否') {
    steps[3].status = 'active'; steps[3].time = `在途 ${o.inTransitDays} 天`;
    steps[2].status = 'done';
  } else if (o.onTime === '是' || o.onTime === '否') {
    if (o.postDate) { steps[3].status = 'done'; steps[3].time = `在途 ${o.inTransitDays} 天`; }
  }
  // 5. 签收
  if (o.onTime === '是' || o.onTime === '否') {
    steps[4].status = 'done';
    steps[4].time = o.onTime === '是' ? '按期签收' : '逾期签收';
  } else if (o.postDate) {
    steps[4].status = 'pending';
  }
  // 当前阶段标签
  let current;
  if (!o.postDate) current = o.onTime === '逾期未发' ? '逾期未发' : '待发货';
  else if (o.onTime === '在途' || (o.inTransitDays > 0 && o.onTime !== '是' && o.onTime !== '否')) current = `在途 · ${o.inTransitDays}天`;
  else if (o.onTime === '是') current = '已交付 · 按期';
  else if (o.onTime === '否') current = '已交付 · 逾期';
  else current = '已发货';
  return { steps, current };
}

function massBadge(onTime) {
  switch (onTime) {
    case '是': return { cls: 'badge--ok', text: '按期' };
    case '否': return { cls: 'badge--err', text: '逾期' };
    case '在途': return { cls: 'badge--petrol', text: '在途' };
    case '待发货': return { cls: 'badge--neutral', text: '待发货' };
    case '逾期未发': return { cls: 'badge--err', text: '逾期未发' };
    default: return { cls: 'badge--neutral', text: onTime };
  }
}

function ownOrders() {
  const owner = OWNERS[STATE.currentUser];
  const pilot = PILOT_ORDERS.filter(o => owner.pilot.includes(o.orderNo));
  const mass = MASS_ORDERS.filter(o => owner.mass.includes(o.orderNo));
  return { pilot, mass };
}

function matchSearch(text, q) {
  if (!q) return true;
  return String(text).toLowerCase().includes(q.toLowerCase());
}

/* ----------------------------------------------------------
   5. 渲染：顶栏 + 模块切换
   ---------------------------------------------------------- */
function renderAppbar() {
  const owner = STATE.currentUser;
  const { pilot, mass } = ownOrders();
  const tabsHtml = STATE.moduleOrder.map(m => {
    const cnt = m === 'pilot' ? pilot.length : mass.length;
    const label = m === 'pilot' ? '试制进度' : '量产交付';
    const active = m === STATE.module ? 'is-active' : '';
    return `<button class="module-tab ${active}" data-module="${m}">
      <span>${label}</span><span class="count">${cnt}</span>
    </button>`;
  }).join('');

  $('#appbar-tabs').innerHTML = tabsHtml;
  $('#appbar-who').textContent = owner;
  $$('#appbar-tabs .module-tab').forEach(t => {
    t.addEventListener('click', () => {
      STATE.module = t.dataset.module;
      renderAll();
    });
  });
}

/* ----------------------------------------------------------
   6. 渲染：试制模块
   ---------------------------------------------------------- */
function renderPilot() {
  const { pilot } = ownOrders();
  const q = STATE.search;
  const typeF = STATE.pilotTypeFilter;
  const onlyExc = STATE.pilotOnlyException;

  let rows = pilot.filter(o => {
    if (typeF !== 'all' && o.type !== typeF) return false;
    if (onlyExc && !pilotProgress(o).exception) return false;
    const hay = [o.orderNo, o.customer, o.product, o.machine, o.base].join(' ');
    return matchSearch(hay, q);
  });

  // 排序：异常优先，再按进度
  rows.sort((a, b) => {
    const pa = pilotProgress(a), pb = pilotProgress(b);
    if (pa.exception && !pb.exception) return -1;
    if (!pa.exception && pb.exception) return 1;
    return pa.done - pb.done;
  });

  const head = `
    <div>试制单号 / 类型</div>
    <div>客户 / 产品</div>
    <div>机台 / 数量</div>
    <div>进度</div>
    <div>当前工序</div>
    <div></div>`;

  const body = rows.length === 0
    ? `<div class="empty">没有匹配的试制订单</div>`
    : rows.map(o => {
        const p = pilotProgress(o);
        const pct = (p.done / p.total) * 100;
        const tm = TYPE_META[o.type];
        const excRow = p.exception ? 'is-exception' : '';
        const fillCls = p.activeIdx >= -1 ? 'has-active' : '';
        return `
        <div class="row ${excRow}" data-pilot="${o.orderNo}">
          <div class="col-no">
            <div>${o.orderNo}</div>
            <div class="sub"><span class="tag ${tm.cls}">${tm.label}</span></div>
          </div>
          <div class="col-customer">
            <div>${o.customer}</div>
            <div class="sub">${o.product}</div>
          </div>
          <div class="col-meta">
            <div>${o.machine}</div>
            <div class="sub">${o.base} · ${o.orderCount} 件</div>
          </div>
          <div>
            <div class="pvw">
              <div class="pvw__track">
                <div class="pvw__fill ${fillCls}" style="width:${pct}%"></div>
              </div>
              <div class="pvw__label">${p.currentLabel}<span class="frac">${p.done}/${p.total}</span></div>
            </div>
          </div>
          <div>
            ${p.exception
              ? `<span class="badge badge--err"><span class="dot"></span>异常</span>`
              : (p.done === p.total
                  ? `<span class="badge badge--ok"><span class="dot"></span>完成</span>`
                  : `<span class="badge badge--petrol"><span class="dot"></span>进行中</span>`)}
          </div>
          <div class="caret">›</div>
        </div>`;
      }).join('');

  return `
    <div class="toolbar">
      <div class="search">
        <span class="search__icon">⌕</span>
        <input id="pilot-search" placeholder="搜订单号 / 客户 / 产品 / 机台" value="${escapeAttr(q)}">
      </div>
      ${['all','xs','gz','sh','oa'].map(t => {
        const labels = { all:'全部', xs:'小试', gz:'中试·广州', sh:'中试·上海', oa:'OA辅助' };
        const active = typeF === t ? 'is-active' : '';
        return `<button class="chip ${active}" data-type="${t}">${labels[t]}</button>`;
      }).join('')}
      <button class="chip ${onlyExc?'is-active':''}" id="pilot-only-exc">仅看异常</button>
    </div>
    <div class="kpis">${pilotKpis(pilot)}</div>
    <div class="list grid-pilot">
      <div class="list__head">${head}</div>
      ${body}
    </div>`;
}

function pilotKpis(pilot) {
  let exc = 0, done = 0, running = 0;
  pilot.forEach(o => {
    const p = pilotProgress(o);
    if (p.exception) exc++;
    if (p.done === p.total) done++;
    else running++;
  });
  return `
    <div class="kpi"><div class="kpi__k">我的试制单</div><div class="kpi__v">${pilot.length}<small>单</small></div></div>
    <div class="kpi"><div class="kpi__k">进行中</div><div class="kpi__v">${running}<small>单</small></div></div>
    <div class="kpi"><div class="kpi__k">已完成</div><div class="kpi__v">${done}<small>单</small></div></div>
    <div class="kpi"><div class="kpi__k">异常</div><div class="kpi__v" style="color:${exc? 'var(--state-error)':'inherit'}">${exc}<small>单</small></div></div>`;
}

/* ----------------------------------------------------------
   7. 渲染：量产模块
   ---------------------------------------------------------- */
function renderMass() {
  const { mass } = ownOrders();
  const q = STATE.search;
  const f = STATE.massStatusFilter;

  let rows = mass.filter(o => {
    if (f !== 'all') {
      const map = { ontime: '是', late: '否', transit: '在途', pending: '待发货' };
      if (o.onTime !== map[f] && !(f === 'late' && o.onTime === '逾期未发')) return false;
    }
    const hay = [o.orderNo, o.deliveryNo, o.shipNo, o.customerOrderNo, o.customer, o.shipTo, o.material, o.materialDesc, o.productLine].join(' ');
    return matchSearch(hay, q);
  });

  rows.sort((a, b) => {
    // 逾期优先，再按预计交期升序
    const rank = o => o.onTime === '逾期未发' ? 0 : o.onTime === '否' ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return a.firstDate.localeCompare(b.firstDate);
  });

  const head = `
    <div>销售订单 / 交货单</div>
    <div>客户 / 产品</div>
    <div>物料 / 产品线</div>
    <div>进度</div>
    <div>预计交期</div>
    <div>交付状态</div>
    <div></div>`;

  const body = rows.length === 0
    ? `<div class="empty">没有匹配的量产订单</div>`
    : rows.map(o => {
        const p = massProgress(o);
        const b = massBadge(o.onTime);
        const pct = (p.steps.filter(s => s.status === 'done').length / p.steps.length) * 100;
        const late = (o.onTime === '否' || o.onTime === '逾期未发') ? 'is-exception' : '';
        return `
        <div class="row ${late}" data-mass="${o.orderNo}">
          <div class="col-no">
            <div>${o.orderNo}</div>
            <div class="sub mono">${o.deliveryNo || '—'} · ${o.shipNo || '未生成'}</div>
          </div>
          <div class="col-customer">
            <div>${o.customer}</div>
            <div class="sub">${o.shipTo}</div>
          </div>
          <div class="col-meta">
            <div>${o.materialDesc}</div>
            <div class="sub">${o.material} · ${o.productLine} · ${o.qty}吨</div>
          </div>
          <div>
            <div class="pvw">
              <div class="pvw__track">
                <div class="pvw__fill has-active" style="width:${Math.max(pct,6)}%"></div>
              </div>
              <div class="pvw__label">${p.current}</div>
            </div>
          </div>
          <div class="col-meta">
            <div class="mono">${o.firstDate}</div>
            <div class="sub">${o.postDate ? '发货 '+o.postDate : '未发货'}</div>
          </div>
          <div><span class="badge ${b.cls}"><span class="dot"></span>${b.text}</span></div>
          <div class="caret">›</div>
        </div>`;
      }).join('');

  return `
    <div class="toolbar">
      <div class="search">
        <span class="search__icon">⌕</span>
        <input id="mass-search" placeholder="搜销售订单 / 交货单 / 送货单 / 客户 / 物料" value="${escapeAttr(q)}">
      </div>
      ${[
        {k:'all',l:'全部'},
        {k:'ontime',l:'按期'},
        {k:'late',l:'逾期'},
        {k:'transit',l:'在途'},
        {k:'pending',l:'待发货'},
      ].map(t => {
        const active = f === t.k ? 'is-active' : '';
        return `<button class="chip ${active}" data-status="${t.k}">${t.l}</button>`;
      }).join('')}
    </div>
    <div class="kpis">${massKpis(mass)}</div>
    <div class="list grid-mass">
      <div class="list__head">${head}</div>
      ${body}
    </div>`;
}

function massKpis(mass) {
  let ontime = 0, late = 0, transit = 0, pending = 0;
  mass.forEach(o => {
    if (o.onTime === '是') ontime++;
    else if (o.onTime === '否' || o.onTime === '逾期未发') late++;
    else if (o.onTime === '在途') transit++;
    else if (o.onTime === '待发货') pending++;
  });
  const rate = mass.length ? Math.round(ontime / mass.length * 100) : 0;
  return `
    <div class="kpi"><div class="kpi__k">我的量产单</div><div class="kpi__v">${mass.length}<small>单</small></div></div>
    <div class="kpi"><div class="kpi__k">按期交付率</div><div class="kpi__v">${rate}<small>%</small></div></div>
    <div class="kpi"><div class="kpi__k">在途</div><div class="kpi__v">${transit}<small>单</small></div></div>
    <div class="kpi"><div class="kpi__k">逾期</div><div class="kpi__v" style="color:${late? 'var(--state-error)':'inherit'}">${late}<small>单</small></div></div>`;
}

/* ----------------------------------------------------------
   8. 渲染：详情抽屉
   ---------------------------------------------------------- */
function openPilotDetail(orderNo) {
  const o = PILOT_ORDERS.find(x => x.orderNo === orderNo);
  if (!o) return;
  const p = pilotProgress(o);
  const tm = TYPE_META[o.type];

  const nodes = PILOT_STEPS.map((s, i) => {
    const step = o.steps[s.key];
    const hasTime = step && step.time;
    const isActive = i === p.activeIdx;
    const isExc = step && step.exception;
    let cls = '';
    if (hasTime && !isExc) cls = 'is-done';
    else if (isActive) cls = 'is-active';
    if (isExc) cls = 'is-exception';
    return `
      <div class="tl-node ${cls}">
        <div class="tl-node__dot"></div>
        <div class="tl-node__title">${s.label}
          ${hasTime && !isExc && i === p.activeIdx-1+1 && isActive ? '' : ''}
          ${isExc ? '<span class="badge badge--err"><span class="dot"></span>异常</span>' : ''}
        </div>
        <div class="tl-node__meta">
          ${hasTime ? `<span class="mono">${step.time}</span><span>责任人：${step.person}</span>` : '<span class="muted">未开始</span>'}
        </div>
        ${isExc ? `<div class="tl-node__exc">⚠ ${step.exception}</div>` : ''}
      </div>`;
  }).join('');

  $('#drawer-head').innerHTML = `
    <button class="drawer__close" id="drawer-close">×</button>
    <div class="drawer__no">${o.orderNo}</div>
    <div class="drawer__sub">
      <span class="tag ${tm.cls}">${tm.label}</span>
      <span>${o.customer}</span>
      <span>·</span>
      <span>${o.product}</span>
      <span>·</span>
      <span>${o.base} · ${o.machine} · ${o.orderCount}件</span>
    </div>`;
  $('#drawer-body').innerHTML = `
    <div class="section-title">订单信息</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-item__k">试制单号</div><div class="info-item__v mono">${o.orderNo}</div></div>
      <div class="info-item"><div class="info-item__k">试制类型</div><div class="info-item__v">${tm.label}</div></div>
      <div class="info-item"><div class="info-item__k">基地 / 机台</div><div class="info-item__v">${o.base} / ${o.machine}</div></div>
      <div class="info-item"><div class="info-item__k">数量</div><div class="info-item__v">${o.orderCount} 件</div></div>
      <div class="info-item"><div class="info-item__k">客户</div><div class="info-item__v">${o.customer}</div></div>
      <div class="info-item"><div class="info-item__k">产品</div><div class="info-item__v">${o.product}</div></div>
    </div>
    <div class="section-title">工序进度 ${p.exception ? '<span class="badge badge--err" style="margin-left:8px"><span class="dot"></span>含异常</span>' : ''}</div>
    <div class="timeline">${nodes}</div>
    <div class="section-title">备注</div>
    <div class="muted" style="font-size:13px">
      工序节点时间与责任人来自 myexcel（${o.base}）实时拉取。
      ${p.exception ? '当前存在异常节点，建议跟进车间处理。' : '当前进度正常。'}
    </div>`;
  openDrawer();
}

function openMassDetail(orderNo) {
  const o = MASS_ORDERS.find(x => x.orderNo === orderNo);
  if (!o) return;
  const p = massProgress(o);
  const b = massBadge(o.onTime);

  const nodes = p.steps.map(s => {
    let cls = '';
    if (s.status === 'done') cls = 'is-done';
    else if (s.status === 'active') cls = 'is-active';
    if (s.key === 'done' && o.onTime === '否') cls = 'is-exception';
    return `
      <div class="tl-node ${cls}">
        <div class="tl-node__dot"></div>
        <div class="tl-node__title">${s.label}${s.status==='active'?'<span class="badge badge--petrol" style="margin-left:8px"><span class="dot"></span>当前</span>':''}</div>
        <div class="tl-node__meta">
          ${s.time ? `<span class="mono">${s.time}</span>` : '<span class="muted">未发生</span>'}
        </div>
      </div>`;
  }).join('');

  $('#drawer-head').innerHTML = `
    <button class="drawer__close" id="drawer-close">×</button>
    <div class="drawer__no">${o.orderNo}</div>
    <div class="drawer__sub">
      <span class="badge ${b.cls}"><span class="dot"></span>${b.text}</span>
      <span>${o.customer}</span>
      <span>·</span>
      <span>${o.shipTo}</span>
      <span>·</span>
      <span>${o.materialDesc}</span>
    </div>`;
  $('#drawer-body').innerHTML = `
    <div class="section-title">订单信息</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-item__k">销售订单</div><div class="info-item__v mono">${o.orderNo}</div></div>
      <div class="info-item"><div class="info-item__k">客户订单号</div><div class="info-item__v mono">${o.customerOrderNo}</div></div>
      <div class="info-item"><div class="info-item__k">交货单</div><div class="info-item__v mono">${o.deliveryNo || '—'}</div></div>
      <div class="info-item"><div class="info-item__k">送货单号</div><div class="info-item__v mono">${o.shipNo || '未生成'}</div></div>
      <div class="info-item"><div class="info-item__k">售达方</div><div class="info-item__v">${o.customer}</div></div>
      <div class="info-item"><div class="info-item__k">送达方</div><div class="info-item__v">${o.shipTo}</div></div>
      <div class="info-item"><div class="info-item__k">物料</div><div class="info-item__v">${o.material} <span class="muted">/ ${o.materialDesc}</span></div></div>
      <div class="info-item"><div class="info-item__k">产品线</div><div class="info-item__v">${o.productLine}</div></div>
      <div class="info-item"><div class="info-item__k">工厂 / 库位</div><div class="info-item__v">${o.plant}</div></div>
      <div class="info-item"><div class="info-item__k">送达地区</div><div class="info-item__v">${o.region} · ${o.city}</div></div>
      <div class="info-item"><div class="info-item__k">发货数量</div><div class="info-item__v">${o.qty} 吨</div></div>
      <div class="info-item"><div class="info-item__k">在途天数</div><div class="info-item__v">${o.inTransitDays} 天</div></div>
    </div>
    <div class="section-title">交付进度</div>
    <div class="timeline">${nodes}</div>
    <div class="section-title">关键时点</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-item__k">订单创建日期</div><div class="info-item__v mono">${o.createDate}</div></div>
      <div class="info-item"><div class="info-item__k">预计交期(首个日期)</div><div class="info-item__v mono">${o.firstDate}</div></div>
      <div class="info-item"><div class="info-item__k">实际发货(过账日期)</div><div class="info-item__v mono">${o.postDate || '—'}</div></div>
      <div class="info-item"><div class="info-item__k">是否按期交付</div><div class="info-item__v"><span class="badge ${b.cls}"><span class="dot"></span>${b.text}</span></div></div>
    </div>`;
  openDrawer();
}

function openDrawer() {
  $('#overlay').classList.add('is-open');
  $('#drawer').classList.add('is-open');
  $('#drawer-close').addEventListener('click', closeDrawer);
}
function closeDrawer() {
  $('#overlay').classList.remove('is-open');
  $('#drawer').classList.remove('is-open');
}

/* ----------------------------------------------------------
   9. 主渲染 + 事件绑定
   ---------------------------------------------------------- */
function renderModule() {
  const root = $('#module');
  if (STATE.module === 'pilot') {
    root.innerHTML = renderPilot();
    bindPilot();
  } else {
    root.innerHTML = renderMass();
    bindMass();
  }
}

function bindPilot() {
  const si = $('#pilot-search');
  if (si) si.addEventListener('input', e => { STATE.search = e.target.value; renderModule(); });
  $$('#module .chip[data-type]').forEach(c => {
    c.addEventListener('click', () => { STATE.pilotTypeFilter = c.dataset.type; renderModule(); });
  });
  const oe = $('#pilot-only-exc');
  if (oe) oe.addEventListener('click', () => { STATE.pilotOnlyException = !STATE.pilotOnlyException; renderModule(); });
  $$('#module .row[data-pilot]').forEach(r => {
    r.addEventListener('click', () => openPilotDetail(r.dataset.pilot));
  });
  // 让搜索框保持焦点
  const si2 = $('#pilot-search');
  if (si2 && STATE.search) { si2.focus(); si2.setSelectionRange(si2.value.length, si2.value.length); }
}

function bindMass() {
  const si = $('#mass-search');
  if (si) si.addEventListener('input', e => { STATE.search = e.target.value; renderModule(); });
  $$('#module .chip[data-status]').forEach(c => {
    c.addEventListener('click', () => { STATE.massStatusFilter = c.dataset.status; renderModule(); });
  });
  $$('#module .row[data-mass]').forEach(r => {
    r.addEventListener('click', () => openMassDetail(r.dataset.mass));
  });
  const si2 = $('#mass-search');
  if (si2 && STATE.search) { si2.focus(); si2.setSelectionRange(si2.value.length, si2.value.length); }
}

function bindGlobal() {
  $('#overlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
  // 切换模块时清空搜索
  $$('#appbar-tabs .module-tab').forEach(t => {
    t.addEventListener('click', () => {
      if (t.dataset.module !== STATE.module) STATE.search = '';
    });
  });
  // 用户切换
  $('#appbar-user').addEventListener('change', e => {
    STATE.currentUser = e.target.value;
    STATE.search = '';
    renderAll();
  });
  // 模块顺序交换
  $('#swap-order').addEventListener('click', () => {
    STATE.moduleOrder = STATE.moduleOrder.reverse();
    saveModuleOrder();
    renderAll();
  });
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function renderAll() {
  renderAppbar();
  renderModule();
}

/* ----------------------------------------------------------
   10. 启动
   ---------------------------------------------------------- */
function init() {
  loadModuleOrder();
  renderAll();
  bindGlobal();
}
document.addEventListener('DOMContentLoaded', init);
