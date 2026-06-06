# GTO Trainer — 德州扑克 GTO 训练平台

基于博弈论最优策略 (Game Theory Optimal) 的德州扑克训练工具。支持中英文双语，全平台自适应，可离线使用。

🔗 **在线体验**: https://gto-trainer-psi.vercel.app

---

## 功能一览

### 🎯 核心训练
| 功能 | 路径 | 说明 |
|------|------|------|
| GTO 手牌训练 | `/trainer` | 翻前 + 翻后场景训练，4 级难度（初级/中级/高级/专家） |
| AI 对手对战 | `/ai-opponent` | 与 GTO AI 真实对局，支持翻前+翻后各街决策 |
| 限时测验 | `/quiz` | 计时答题模式，30s/60s/120s/300s 可选，保存最高分 |
| 锦标赛 ICM | `/tournament` | 泡沫圈/决赛桌场景，ICM 感知的 GTO 训练 |

### 📊 范围与计算
| 功能 | 路径 | 说明 |
|------|------|------|
| 范围查看器 | `/ranges` | 13×13 手牌矩阵，支持翻前/翻后场景，双范围对比模式 |
| 范围编辑器 | `/range-editor` | 拖拽创建自定义范围，导出/分享 |
| EV 计算器 | `/calculator` | Monte Carlo 模拟 10000 次，计算胜率和期望值 |

### 📈 数据与分析
| 功能 | 路径 | 说明 |
|------|------|------|
| 训练仪表板 | `/dashboard` | 总手数、正确率、连对记录、场景表现分析 |
| 错题本 | `/mistakes` | 收集答错的手牌，支持按场景过滤和重新练习 |
| 训练历史 | `/history` | 按日期分组的训练记录，可展开查看详情 |
| 手牌导入 | `/history-import` | 导入 PokerStars 手牌历史，GTO 偏差分析 |

### ⚙️ 系统功能
| 功能 | 说明 |
|------|------|
| 中英文双语 | Navbar 一键切换，全站 10+ 页面已翻译 |
| 深色/浅色主题 | 一键切换，持久化存储 |
| PWA 离线模式 | 可安装到手机桌面，离线训练 |
| 每日训练提醒 | 浏览器通知提醒 |
| Supabase 认证 | 注册/登录，训练数据云端同步 |
| 自动下一题 | 可配置延迟时间 |

---

## GTO 数据

### 数据来源
所有翻前范围数据经两个独立开源项目**交叉验证**：
- [AHTOOOXA/poker-charts](https://github.com/AHTOOOXA/poker-charts) — GreenCharts 2024
- [SStoyanov22/gto-poker](https://github.com/SStoyanov22/gto-poker) — GTO Wizard 数据

### 数据覆盖
| 类型 | 场景数 | 说明 |
|------|--------|------|
| 翻前 RFI | 5 | UTG/MP/CO/BTN/SB 各位置开牌范围 |
| 翻前 3bet | 4 | BTN vs CO/SB vs BTN/BB vs CO/SB vs CO |
| 翻前防守 | 3 | BB vs BTN/CO/UTG |
| 翻后 C-bet | 4 | 干燥/湿润/配对/同花牌面 |
| 翻后 Turn | 6 | 空白/同花完成/顺子完成/高牌/配对/第二枪 |
| 翻后 River | 5 | 空白/惊悚/配对/价值下注/抓诈唬 |
| **合计** | **27** | 所有 169 手牌完整覆盖 |

### Solver CLI（Rust）
内置 `tools/solver-cli/` 工具，基于 [postflop-solver](https://github.com/b-inary/postflop-solver) 可精确计算 GTO 解：
```bash
cd tools/solver-cli
cargo run -- solve --scenario scenarios/cbet_test.toml --output ../../src/data/solver-output/test.json
```

---

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | React + TypeScript | 19.x |
| 构建工具 | Vite | 6.x |
| 样式 | Tailwind CSS | 4.x |
| 状态管理 | Zustand | 5.x |
| 路由 | React Router | 7.x |
| 认证/数据库 | Supabase | 2.x |
| 扑克计算 | pokersolver | 2.1.4 |
| 图表 | Recharts | 3.x |
| 国际化 | 自研 i18n (React Context) | - |
| 测试 | Vitest + Testing Library | - |
| 部署 | Vercel | - |
| Solver | postflop-solver (Rust) | - |

---

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/peterzhangbo/gto-trainer.git
cd gto-trainer

# 安装依赖（注意：需要 --include=dev）
npm install --include=dev

# 启动开发服务器
npm run dev
```

访问 http://localhost:5173

### 环境变量（可选）

创建 `.env.local` 启用 Supabase 云端同步：
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

不配置也可正常使用，数据保存在浏览器本地。

### 可用命令

```bash
npm run dev          # 开发服务器
npm run build        # 生产构建
npm run preview      # 预览生产构建
npm run lint         # ESLint 检查
npx vitest run       # 运行测试（150 个测试用例）
```

---

## 项目结构

```
gto-trainer/
├── src/
│   ├── pages/           # 15 个页面组件（懒加载）
│   ├── components/
│   │   ├── ui/          # 通用 UI（Button, Card, Modal, Toast, Spinner...）
│   │   ├── poker/       # 扑克组件（CardDisplay, HandMatrix, ActionButtons...）
│   │   └── layout/      # 布局组件（Navbar, AuthGuard...）
│   ├── data/            # 30 个 GTO JSON 数据文件
│   ├── lib/
│   │   ├── poker/       # 扑克引擎（手牌评估、Monte Carlo、范围解析）
│   │   ├── gto/         # GTO 查询、评分、EV 计算
│   │   ├── i18n.tsx     # 中英文双语系统
│   │   ├── theme.tsx    # 深色/浅色主题
│   │   └── notifications.ts  # 每日提醒
│   ├── stores/          # Zustand 状态管理
│   ├── hooks/           # 自定义 Hooks
│   ├── types/           # TypeScript 类型定义
│   └── workers/         # Web Worker（Monte Carlo 模拟）
├── tools/
│   └── solver-cli/      # Rust GTO Solver CLI 工具
├── supabase/
│   └── migrations/      # SQL 迁移文件
├── public/
│   ├── manifest.json    # PWA 配置
│   └── sw.js            # Service Worker
└── vercel.json          # Vercel 部署配置
```

---

## 部署

### Vercel（推荐）
1. Fork 本仓库
2. 登录 [vercel.com](https://vercel.com)，Import 仓库
3. 添加环境变量（可选）
4. 自动部署完成

详细步骤见 [DEPLOY.md](./DEPLOY.md)

### Supabase 配置
1. 创建 [Supabase](https://supabase.com) 项目
2. 运行 `supabase/migrations/` 下的 SQL 文件
3. 复制 URL 和 anon key 到 `.env.local`

详细步骤见 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

---

## 许可

MIT License
