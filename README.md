# ev-app · 真实电耗记录

> 用**实际充入电量**和**实际里程**算真实百公里电耗与成本，不信车机估算。
>
> 线上：https://apc.llw2025.com　|　文档：[docs/](docs/00-文档索引.md)

---

## 这是什么

电动车仪表盘的「剩余续航」是估算值，标定偏乐观且随环境漂移。你充了 50 度电、表显掉了 300 公里，账面上是 16.7 kWh/100km，但实际那 50 度只让你跑了 200 公里。

这个应用解决三件事：

1. **真实电耗** —— 用充电桩给的真实度数 ÷ 真实里程，得出可信的百公里电耗
2. **部分充电正确处理** —— 充 50 度只跑 30 km 这种「过充」场景，普通算法会严重高估；本应用用车显续航作电量代理，能算准
3. **真实成本** —— 百公里均价直接对应实际花销，可反推充电桩计费是否合理

支持乘用车与两轮车（充满自停场景自动退化为简单模型）。

---

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Vue 3.4 + Vite 5 + TypeScript 5 + Pinia | SPA，无路由库（5 个 Tab 用状态切换） |
| 图表 | ECharts 5 | 4 张概览图 + 2 张分析图 |
| 图标 | lucide-vue-next | 线性图标 |
| 后端 | Node 20 + Express 4 + JWT | ESM，`type: module` |
| 数据库 | SQLite（better-sqlite3 11） | 单实例文件库，WAL 模式 |
| 部署 | Docker 多阶段构建 + Coolify + Traefik | 镜像内构建前端，apc.llw2025.com |

**依赖版本注意**：JS 单包 **1.19 MB**（gzip 398 KB），已触发体积警告阈值。新增依赖前先评估体积。

---

## 快速开始

### 环境要求

- Node.js ≥ 20
- npm ≥ 10
- 无需数据库服务（SQLite 文件库）

### 安装与启动

```bash
# 1. 安装依赖（前端 + 后端）
npm install
npm --prefix server install

# 2. 同时启动前后端
#    后端 http://localhost:3000
#    前端 http://localhost:5173（/api 自动代理到 3000）
npm run dev          # 前端
npm run dev:server   # 后端（另开一个终端）

# 3. 打开 http://localhost:5173，注册账号
```

### 首次使用需要配置

1. **添加车辆** —— 车型名、电池容量 `B`、最大充电功率 `Pmax`
2. **配置基线** —— `M0`（开始记录前那次充电结束时的里程）、`R0`（当时的剩余车显）
   - 填了 → 首条记录即可参与计算
   - 没填 → 首条自动成为「基准记录」，从第二条开始算

`M0`/`R0` 填错不会损坏数据，系统会自动降级处理。详见 [03-数据采集规范](docs/03-数据采集规范.md)。

---

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run dev` | 前端开发服务器（:5173） |
| `npm run dev:server` | 后端开发服务器（:3000，`--watch` 自动重启） |
| `npm run build` | 构建前端产物到 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm start` | 启动后端（生产模式） |

### 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `PORT` | `3000` | 后端监听端口 |
| `DB_PATH` | `./data/ev.sqlite` | SQLite 文件路径（容器内为 `/data/ev.sqlite`） |
| `JWT_SECRET` | 无 | **生产环境必填**，否则启动即 fatal |
| `CORS_ORIGIN` | 空 | 留空表示不启用跨域（同域部署无需设置） |
| `NODE_ENV` | — | `production` 时强制要求 `JWT_SECRET` |
| `EV_KEEP_DIST` | — | 设为 `1` 时构建不清空 `dist/`（仅受限沙箱环境需要） |

---

## 目录结构

```
ev-app/
├── index.html                 # 入口 HTML（含 PWA meta）
├── vite.config.ts             # 构建配置
├── Dockerfile                 # 多阶段构建：前端 → 后端依赖 → 运行镜像
├── ecosystem.config.cjs       # PM2 配置（强制 fork 单实例）
├── update.sh                  # 服务器更新脚本
│
├── src/                       # ── 前端（2664 行）
│   ├── main.ts                # 应用引导、SW 注册
│   ├── App.vue                # 根组件、5 个 Tab 切换
│   ├── style.css              # 设计 token + 全局样式 + 响应式断点（665 行）
│   ├── types.ts               # 全局类型定义
│   │
│   ├── api/                   # 接口层
│   │   ├── client.ts          # fetch 封装、token 注入、错误处理
│   │   ├── auth.ts            # 注册/登录/获取当前用户
│   │   ├── vehicles.ts        # 车辆 CRUD
│   │   ├── sessions.ts        # 记录 CRUD
│   │   └── data.ts            # 示例数据/整库替换/清空
│   │
│   ├── store/
│   │   └── useAppStore.ts     # Pinia 全局状态（466 行，唯一数据源）
│   │
│   ├── utils/
│   │   ├── calc.ts            # ★ 测算引擎（123 行，核心）
│   │   ├── format.ts          # round/fmtNum（必须 !isFinite）
│   │   ├── validation.ts      # 前端校验
│   │   ├── exporters.ts       # JSON/CSV 导出
│   │   └── toast.ts           # 轻量 Toast
│   │
│   ├── components/            # 8 个组件
│   │   ├── BaseChart.vue      # ECharts 封装（高度取 --chart-h）
│   │   ├── VehicleCard.vue    # 顶部 Hero 卡
│   │   ├── VehicleManager.vue # 车辆管理弹层（增删改）
│   │   ├── VehicleConfig.vue  # 车辆数值配置表单
│   │   ├── SessionForm.vue    # 记录录入/补全表单
│   │   ├── SessionList.vue    # 记录列表
│   │   ├── SessionEditModal.vue # 记录编辑弹层
│   │   └── ToastHost.vue      # 全局提示容器（挂根级）
│   │
│   └── views/                 # 6 个页面
│       ├── AuthView.vue       # 登录/注册
│       ├── OverviewView.vue   # 概览（295 行）
│       ├── RecordsView.vue    # 记录
│       ├── AnalysisView.vue   # 分析
│       ├── DataView.vue       # 数据管理
│       └── HelpView.vue       # 帮助
│
├── server/                    # ── 后端（508 行）
│   └── src/
│       ├── index.js           # Express 入口、静态托管、SPA 回退（84 行）
│       ├── db.js              # SQLite 初始化、三表 DDL、索引
│       ├── auth.js            # 密码哈希、JWT 签发
│       ├── validation.js      # 服务端入参校验
│       ├── serialize.js       # 驼峰/下划线字段转换
│       ├── middleware/auth.js # Bearer 鉴权中间件
│       └── routes/            # 4 个路由模块（13 个接口）
│
├── public/                    # 静态资源
│   ├── sw.js                  # Service Worker（缓存策略）
│   ├── manifest.webmanifest   # PWA 清单
│   ├── icon.svg / favicon.svg
│
└── docs/                      # ── 文档（14 篇）
    ├── 00-文档索引.md          # 从这里开始
    ├── 01-产品需求.md
    ├── 02-功能清单.md
    ├── 03-数据采集规范.md
    ├── 04-需求变更记录.md
    ├── 05-设计规范.md
    ├── 06-响应式布局规范.md
    ├── 07-交互状态设计.md
    ├── 08-算法-测算原理.md    # ★ 核心
    ├── 09-API接口.md
    ├── 10-数据模型.md
    ├── 11-部署运维手册.md
    ├── 12-前端架构说明.md
    ├── 13-开发规范.md
    └── 14-已知问题.md
```

---

## 架构要点

### 数据流

```
用户输入
  ↓
api/*.ts ──fetch──▶ Express 路由 ──▶ better-sqlite3 ──▶ /data/ev.sqlite
  ↓                                    ↓
Pinia store ◀── normVehicle/normSession ┘
  ↓
computed → utils/calc.ts（纯函数，全量重算）
  ↓
组件渲染（4 张图 + 指标卡）
```

**关键点**：`calc.ts` 是**纯函数**，输入车辆配置 + 记录数组，输出全部段与累计指标。不依赖 store、不发请求、不写状态，因此可以独立测试与验证。

### 字段命名差异（易踩坑）

| 层 | 命名风格 | 示例 |
|---|---|---|
| 数据库 | 下划线 | `vehicle_id`、`created_at` |
| API JSON | 下划线 | 同上 |
| TypeScript | 驼峰 | `vehicleId`、`createdAt` |

由 `server/src/serialize.js` 和 `normVehicle`/`normSession` 双向转换。**混用会导致静默空数据**。详见 [10-数据模型](docs/10-数据模型.md)。

### 全量重算

任意增删改后，`useAppStore` 会调 `computed` 重新执行 `calc.ts` 的 `computeAll()`，对所有段重新测算。幂等、无累积误差。详见 [12-前端架构说明](docs/12-前端架构说明.md)。

---

## 部署

生产环境跑在 **47.121.185.253**（Ubuntu 26.04），由 **Coolify** 编排，Traefik 做 TLS 与路由。

完整发布流程、SSH 排查、数据备份恢复见 [11-部署运维手册](docs/11-部署运维手册.md)。

⚠️ **发布前必读**：构建前必须清空 `dist/`（现已由 `emptyOutDir` 自动处理）；镜像构建约需 2-3 分钟。

---

## 性能与体积

| 指标 | 值 | 说明 |
|---|---|---|
| JS 单包 | 1.19 MB（gzip 398 KB） | ECharts 占主要体积 |
| CSS | 21.8 KB（gzip 5.25 KB） | — |
| 首屏构建 | ~5-12 s | |
| 镜像构建 | ~2-3 min | 含 better-sqlite3 源码编译 |
| 运行时内存 | < 512 MB | PM2 配置 `max_memory_restart: 512M` |

**优化空间**：ECharts 按需引入可减少约 600KB，当前未做。

---

## 许可与数据

- 数据存于自有服务器 SQLite，**需登录才能读写**，不同账号数据隔离
- 导出的 JSON / CSV 保存在用户本地设备，不上传
- 备份 JWT_SECRET 至关重要——泄露即可伪造任意账号的 token
