# 推送到 GitHub 说明

## 当前状态

- 本地 Git 仓库已初始化
- 所有产物已提交（commit: `cad8774`）
- 分支: `master`

## 需要你提供

1. GitHub 仓库 URL，例如：
   - `https://github.com/yourname/order-progress-board.git`
2. Personal Access Token（classic），需勾选 `repo` 权限

## 推送后代码中可调用的 raw URL 示例

假设仓库为 `https://github.com/yourname/order-progress-board`，默认分支为 `main` 或 `master`：

```
https://raw.githubusercontent.com/yourname/order-progress-board/main/colors_and_type.css
https://raw.githubusercontent.com/yourname/order-progress-board/main/pages/list-trial.html
https://raw.githubusercontent.com/yourname/order-progress-board/main/pages/list-mass.html
https://raw.githubusercontent.com/yourname/order-progress-board/main/pages/detail-trial.html
https://raw.githubusercontent.com/yourname/order-progress-board/main/pages/detail-mass.html
https://raw.githubusercontent.com/yourname/order-progress-board/main/handoff.md
```

## 目录结构

```
order-progress-board/
├── colors_and_type.css          # 品牌令牌
├── handoff.md                   # 设计交接文档
├── order-progress-board.design  # 设计画布节点
├── pages/
│   ├── dashboard.html
│   ├── list-trial.html
│   ├── list-mass.html
│   ├── detail-trial.html
│   └── detail-mass.html
└── runtime-orchestration-summary.json
```
