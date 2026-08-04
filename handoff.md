# 订单进度台 — 设计转开发交接说明

## 1. 项目概述

- **项目名称**：订单进度台
- **用途**：销售人员跟踪“试制订单”与“量产订单”进度
- **设计方向**：阶段轨道结构 + 瑞士极简执行美学
- **交付形态**：桌面端 app-shell 工作台，5 个 HTML 页面原型 + `.design` 画布节点

## 2. 文件结构

```
order-progress-board/
├── order-progress-board.design   # 画布项目：页面节点、位置、交互连线
├── colors_and_type.css           # 品牌设计令牌
├── pages/
│   ├── dashboard.html            # v1 旧版参考（可忽略）
│   ├── list-mass.html            # 量产交付监控（列表）
│   ├── list-trial.html           # 试制进度监控（列表）
│   ├── detail-mass.html          # 量产订单详情
│   └── detail-trial.html         # 试制订单详情
└── assets/                       # 静态资源目录（当前为空）
```

## 3. 设计令牌

所有页面共用 `colors_and_type.css` 中的变量，开发时请直接复用，不要硬编码颜色。

| 变量名 | 值 | 用途 |
|---|---|---|
| `--brand-background` | `#f5f3ee` | 页面背景（暖纸色） |
| `--brand-foreground` | `#1b1a17` | 主文字（墨色） |
| `--brand-card` | `#fffdf8` | 卡片/侧边栏背景 |
| `--brand-primary` | `#13524a` | 深 petrol，唯一品牌强调色 |
| `--brand-primary-foreground` | `#f5f3ee` | 主色上的文字 |
| `--brand-muted` | `#ece7dc` | 次级背景/标签 |
| `--brand-muted-foreground` | `#6f6a5e` | 次级文字 |
| `--brand-border` | `#e0dacd` | 发丝级边框/分隔线 |
| `--state-success` | `#2f7a4d` | 成功/正常 |
| `--state-warning` | `#a9700f` | 警告 |
| `--state-error` | `#ad3a2d` | 异常/逾期 |
| `--track-rail` | `#d9d3c5` | 未开始阶段导轨 |
| `--track-done` | `#3a7d73` | 已完成阶段 |
| `--track-active` | `#13524a` | 当前阶段 |

**字体栈**：`--brand-font-sans` 用于正文，`--brand-font-mono` 用于订单号、日期、数字；全局使用 `font-variant-numeric: tabular-nums`。

**圆角**：`sm=4px`、`md=8px`、`lg=12px`。

## 4. 页面清单

| 页面 | 文件 | 说明 | 主要交互 |
|---|---|---|---|
| 量产交付监控 | `pages/list-mass.html` | 5 段交付进度条表格 | 列表行 → `detail-mass.html`；切换试制 → `list-trial.html` |
| 试制进度监控 | `pages/list-trial.html` | 8 段工序进度条表格 | 列表行 → `detail-trial.html`；切换量产 → `list-mass.html` |
| 量产订单详情 | `pages/detail-mass.html` | 交付时间轴 + 订单信息卡片 | 返回列表 → `list-mass.html`；切换试制 → `list-trial.html` |
| 试制订单详情 | `pages/detail-trial.html` | 工序时间轴 + 异常提示 + 订单信息 | 返回列表 → `list-trial.html`；切换量产 → `list-mass.html` |

## 5. 通用布局结构

每个页面都是统一的 app-shell：

```
<main data-viewport-mode="app-shell" class="opb-app">
  <header class="opb-top-header">      <!-- 56px 高：标题、搜索、同步、导出 -->
  <div class="opb-body">
    <aside class="opb-sidebar" id="module-sidebar">  <!-- 180px 宽模块导航 -->
    <div data-scroll-region="primary" class="opb-scroll">  <!-- 主内容滚动区 -->
  </div>
</main>
```

### 模块导航

- 两个入口：`量产交付`（icon: package） / `试制进度`（icon: flask-conical）
- 当前页面对应项加 `.active`：背景 `--brand-primary`，文字 `--brand-primary-foreground`
- 导航链接已带 `data-dom-id="nav-mass"` / `data-dom-id="nav-trial"`

## 6. 关键组件类名

| 类名 | 用途 |
|---|---|
| `.opb-table` | 列表页表格 |
| `.stage-track` + `.seg` | 阶段/工序进度条（`.done`、`.active`、`.error`） |
| `.opb-status` | 状态标签（正常/异常/逾期） |
| `.opb-tag` | 普通标签；`.opb-tag-error` 异常标签 |
| `.opb-btn` / `.opb-btn-text` | 按钮 |
| `.opb-input` / `.opb-select` | 搜索框与筛选下拉 |
| `.opb-card` / `.meta-card` | 详情页信息卡片 |
| `.timeline` / `.timeline__node` | 量产详情水平时间轴 |
| `.opb-timeline` / `.opb-timeline-item` | 试制详情垂直时间轴 |
| `.opb-alert` | 异常提示条 |

## 7. 交互映射（.design）

`.design` 中每个页面节点的 `devMetadata.interactions` 已注册 DOM ID 到目标页面的映射，开发时可直接绑定路由：

- **list-mass**：`nav-trial` → `page-list-trial`；`row-mass-*` × 6 → `page-detail-mass`
- **list-trial**：`nav-mass` → `page-list-mass`；`row-trial-*` × 6 → `page-detail-trial`
- **detail-mass**：`nav-trial` → `page-list-trial`；`back-to-list` → `page-list-mass`
- **detail-trial**：`nav-mass` → `page-list-mass`；`back-to-list` → `page-list-trial`

HTML 中已使用 `onclick="location.href='...'"` 作为原型跳转，开发时可替换为框架路由。

## 8. 开发建议

1. **直接复用 HTML 结构**：`pages/` 下的页面已经具备完整 DOM 和样式，可直接迁移到 React/Vue 组件中。
2. **Tailwind**：页面使用 Tailwind v4 浏览器运行时（`@tailwindcss/browser@4.3.1`），head 中已注入 `@theme inline` 映射到品牌变量。开发环境建议改用构建版 Tailwind，并复用 `colors_and_type.css`。
3. **图标**：使用 `lucide`（`data-lucide` 属性 + `lucide.createIcons()`），框架中可替换为 `lucide-react` / `lucide-vue`。
4. **响应式**：当前为桌面优先；小屏下主要保证表格横向滚动与详情页两列卡片变为单列。
5. **数据对接**：列表/详情中的订单号、客户、物料、阶段、日期均为示例数据，接入后端后替换为真实字段即可；阶段进度条通过给对应 `.seg` 加 `.done` / `.active` 控制。

## 9. 验收状态

- 设计文件格式校验：通过
- 页面基础设施校验：通过
- 交互连线注册：已完成
- `finish-readiness` 最终交付检查：通过
