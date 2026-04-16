# jimeng-desktop — Claude 工作手册

> **每次会话开始时必读。** 本文件记录项目当前状态、已实现功能、关键架构决策和禁忌。
> 改完代码后必须更新对应章节。

---

## 项目概述

Electron + React + Vite 桌面应用，封装「即梦（Dreamina/Seedance）」AI 视频生成，支持单任务和批量任务。
- **前端**：`src/` — React + Zustand + Tailwind v4（CSS-first，OKLCH 变量，无 tailwind.config.js）
- **主进程**：`electron/` — Electron IPC, `electron/services/` 业务逻辑
- **CLI 依赖**：`~/.local/bin/dreamina`（即梦官方命令行）
- **GitHub**：每次改完必须 commit + push

---

## 核心架构

### 两条生成链路
| 链路 | 模型 | 实现位置 |
|------|------|---------|
| Seedance（即梦）| `seedance2.0`, `seedance2.0fast` | `electron/services/batch-task-manager.js` + dreamina CLI |
| Kling O1 | `kling-o1` | `electron/coze.js`（Coze workflow via PAT token）|

### 任务流程
- **单任务**：ChatPanel → `runStructuredTask` IPC → `electron/main.js` → dreamina CLI → `onProgress` 事件推前端
- **批量任务**：ChatPanel → `createBatch` + `startBatch` IPC → `BatchTaskManager` → 逐个提交 CLI → `batch-task-update` 事件推前端
- **并发上限**：`MAX_CONCURRENT_JIMENG = 2`（Seedance 账号同时最多 2 个任务）

### 状态管理（Zustand，`src/store.ts`）
- `tasks: TaskRecord[]` — 单任务列表（localStorage 持久化）
- `batchTasks: BatchTaskItem[]` — 当前批次子任务（**内存状态**，不持久化）
- `batchHistory: BatchHistoryRecord[]` — 已完成批次历史（localStorage 持久化）
- `batchInfo: BatchInfo | null` — 当前批次元信息
- `auth: AuthUser | null` — 登录状态
- `credits: CreditsState` — VidClaw 平台积分（localStorage 持久化，不被即梦数据覆盖）
- `jimengBalance: number` — 即梦账号余额缓存（内存，不持久化，启动时从 checkCredits 拉取）

### IPC 通道（主进程 ↔ 渲染进程）
- `batch-task-update`：子任务状态变更（含 `queuePosition`, `queueStatus`, `queueLength`）
- `batch-complete`：整批完成
- `onProgress` / `onComplete`：单任务进度
- `onLoginRequired` / `onLoginDetected`：登录状态变化

---

## 已实现功能（稳定，不要动）

### 认证系统
- **邮箱登录**：仅允许 `@miaoboai.com` 后缀（`electron/services/account-manager.js`）
- **QR 码登录**：`authLogin` IPC → 返回二维码图片路径
- **登录守卫**：`App.tsx` — `auth` 为 null 时显示 `AuthModal`，阻止进入主界面
- **积分显示**：余额 < 50 时顶部显示低积分警告横幅（`App.tsx` line ~235）

### 批量任务系统（`electron/services/batch-task-manager.js`）
- `createBatch()` 会**无条件重置**旧批次（包括 running 状态），解决"批量任务已在运行中"报错
- 轮询架构：`setTimeout` 链式调用（5s 首次 → Queuing 时 180s → 其他 30s）
- 失败计数：连续 10 次轮询失败 → 自动标记 `failed`（防止 ret=2008 死循环）
- `_onBatchComplete()` 会调用 `_persistTasks()` 保存 `running: false`（防止重启后恢复 running 状态）
- 恢复时检测：如果所有任务已完成，`running` 直接置 false，不重启轮询

### 队列位置显示（`queueStatus` 字段）
- CLI 返回的 `queue_status` 字段：
  - `"Generating"` = 正在生成（不是排队，**不要显示排队位数**）
  - `"Queuing"` = 在服务端排队等待，此时 `queue_idx` 才是真实位置
- `queuePosition = queue_idx`（0-based），显示时 +1 变成人类可读
- 三个字段同步传递：`queuePosition`, `queueStatus`, `queueLength`

### App 启动恢复（`src/App.tsx` `init()` 函数）
- 启动时调用 `getBatchStatus()` 恢复 `batchTasks`
- 若有进行中任务 → 自动切换到 `works` 面板
- 若批次**全部完成**但 `batchHistory` 中不存在 → 自动补录一条 `batchHistory`（防止重启丢失完成记录）

### WorksPanel 布局
- **生成队列区**：显示在页面顶部，在完成作品列表上方
  - `BatchQueueCard`：批量任务显示为**单个卡片**，含 Activity Rail（无展开折叠）
  - `QueueCard`：单任务（Kling / Seedance 单次）卡片
  - 无折叠上限，全部显示，父容器 `overflow-y-auto` 自然滚动
- **作品区**：已完成单任务 + 批量历史，按日期分组（今天/昨天/本周/更早）
- **视图切换**：网格 / 列表（右上角图标）
- **卡片圆角规范**：队列卡 `rounded-xl`，单任务作品卡 grid=`rounded-2xl` / list=`rounded-xl`，批量文件夹卡 grid=`rounded-2xl` / list=`rounded-xl`

### BatchQueueCard 状态显示逻辑
```
isRunning 为 false → "已完成"（绿色）
activeTask.queueStatus === 'Queuing' → "排队第N位"（橙色 text-warning）
activeTask.queueStatus === 'Generating' → "生成中"（品牌色 text-brand）
其他 → "提交中"（品牌色 text-brand）
```
状态均以彩色圆点（`w-2 h-2 rounded-full`）而非图标表示。

### 本地文件服务器
- `electron/services/` 中有本地 HTTP 文件服务器（端口动态分配，通过 `getFileServerPort` IPC 获取）
- 本地视频/图片通过 `localFileUrlSync()` 转成 `http://localhost:{port}/...` URL 播放

### 视频预览
- `VideoModal` 组件（`src/components/VideoModal.tsx`）全屏浮层
- 通过 `setPreviewUrl()` 触发，`previewUrl: null` 关闭

### Skills（技能库）
- 保存可复用的视频生成配方（prompt 组合 + 参数）
- 支持 Kling O1 和 Seedance 批量任务
- 素材槽位（materialSlots）支持图片/视频/音频绑定

### 可灵 O1 三种发送模式统一（2026-04-15 完成）

**核心改动**（仅 `src/components/ChatPanel.tsx`）：
- **删除了短路**：`handleSend()` 中移除了 `if (kling-o1) → handleKlingSend()` 早返回，三种模式对可灵均生效
- **图片校验**：`handleSend()` 顶部加图片存在校验，无图片时提示错误，Seedance 不受影响
- **专业模式**：`handleDirectSend()` — 可灵时弹出 `kling-confirm` 确认卡（而非直接提交）
- **智能生成**：`handleConfirmTask()` — 走 AI 改写流程，确认后调用 `window.api.klingGenerate()`
- **批量规划**：`handleConfirmBatch()` — 走 AI 拆解流程，确认后逐条调用 `klingGenerate`
- **积分显示**：可灵模式只显示 VidClaw 余额；Seedance 模式只显示即梦账号余额（见「确认卡积分展示规则」）

**积分来源**：`credits.balance`（VidClaw 平台积分），单价 `selectedDuration × 10` 积分/条。

**不要动**：
- `handleConfirmKling()` — 处理专业模式确认卡点击，调用 `klingGenerate` + 扣积分
- Seedance 任何链路——改动完全不影响 Seedance

---

## CSS / 样式规范（Tailwind v4）

**绝对禁止**：修改或创建 `tailwind.config.js`（项目不用它）

变量定义在 CSS `@theme` 块中（OKLCH 格式）：
```css
--color-brand: oklch(0.65 0.2 250);
--color-surface-0 / surface-1 / surface-2 / surface-3
--color-text-primary / text-secondary / text-muted / text-disabled
--color-border / border-subtle
--color-success / error / warning
--shadow-brand-sm
```

卡片标准容器：`bg-surface-2 border border-border rounded-md p-3`
微型文字：`text-[10px]` / `text-[11px]`（非标 Tailwind size，必须用方括号）

---

## 文件职责速查

| 文件 | 职责 |
|------|------|
| `src/App.tsx` | 应用初始化、登录守卫、面板路由、全局事件监听 |
| `src/store.ts` | 所有前端状态定义（Zustand）|
| `src/components/WorksPanel.tsx` | 作品页：生成队列 + 已完成作品 |
| `src/components/ChatPanel.tsx` | 主聊天界面，任务提交入口 |
| `src/components/QueuePanel.tsx` | 独立排队面板（sidebar 入口，不含批量进度）|
| `electron/main.js` | IPC 注册、主进程入口 |
| `electron/services/batch-task-manager.js` | 批量任务全生命周期管理 |
| `electron/services/automation.js` | 浏览器自动化（Seedance 单任务）|
| `electron/coze.js` | Kling O1 via Coze workflow |

---

## 开发流程规范

1. **每次改完**：按序执行以下命令，确保 Vite 永远抢到 5173（避免端口漂移导致 localStorage 数据丢失）：
   ```bash
   lsof -ti:5173 | xargs kill -9 2>/dev/null
   lsof -ti:5174 | xargs kill -9 2>/dev/null
   pkill -f "electron" 2>/dev/null
   npm run electron:dev > /tmp/electron-dev.log 2>&1 &
   ```
2. **每次改完**：`git add` + `git commit` + `git push origin main`
3. **改完重要功能后**：更新本文件对应章节

---

## 已知问题 / 技术债

- `src/renderer/` 目录下有旧版组件（重构遗留），实际使用的是 `src/components/`
- `src/components/chat/ClarificationCard.tsx` 等有 TypeScript 类型错误（pre-existing，非新引入）
- `BatchTaskItem.queueStatus` 是 string 而非 enum，依赖运行时字符串比较

---

### 确认卡参数适配（2026-04-15 完成）

**问题：** `ConfirmCard`（智能生成）和 `BatchConfirmCard`（批量规划）的 MODEL_OPTIONS 硬编码 Seedance，
导致 Kling 模式下模型标签显示错误、比例选项包含 Kling 不支持的值。

**修复位置：** 仅 `src/components/ChatPanel.tsx` 和 `electron/services/ai.js`

**规则：**
- `MODEL_OPTIONS` 含 `kling-o1 / seedance2.0fast / seedance2.0` 三项
- `isKling` 为 true 时：模型区改为只读静态标签，比例选项 = `['9:16','16:9','1:1']`
- `isKling` 为 false 时：模型按钮只显示两个 Seedance 选项（`filter(m => m.value !== 'kling-o1')`）
- `ai.js` `generateBatchTasks`：Kling 模式锁定 `aspectRatio = defaultAspectRatio`，不让 AI 覆盖

**不要动：** Seedance 链路任何部分

*最后更新：2026-04-15（确认卡 Kling 参数适配）*

---

### 工具栏模型值修复（2026-04-15 完成，commit bf9764c）

- 工具栏 PillSelect 的 Seedance 选项值从 `seedance_2.0_fast`/`seedance_2.0`（有下划线）改为 `seedance2.0fast`/`seedance2.0`（无下划线），与 CLI 官方格式一致
- 同步修复了 `ParameterPanel`（QueuePanel 内部）里的相同选项值
- 删除了 skill model label 的双格式兼容 workaround（不再需要）

---

### 多项功能修复（2026-04-15 完成，commit bf9764c）

#### 自动下载开关（electron/main.js）
- Seedance 任务完成时检查 `settings.autoDownload`
  - `false`：只保存 `resultUrl`，不下载，`downloaded: false`（用户可手动下载）
  - `true`：自动下载到本地，发送 `filePath`，`downloaded: true`
  - 下载失败：发送 `downloadError` 字段

#### 排队状态区分（electron/main.js + store + UI）
- 轮询时区分 `Queuing`（服务端排队）和 `Generating`（正在生成）两种状态
- `Queuing` → 发送 `queued` 事件 + `queuePosition`，UI 显示「第N位」
- `Generating` → 发送 `generating` 事件

#### 积分余额修复（store.ts）
- 新增 `normalizeCreditsState(credits, auth)`：内部用户从交易历史重算余额，修复脏 localStorage 值
- 新增 `reconcileCreditsBalance()` action：App 启动时调用，确保 VidClaw 余额正确
- `setAuth` 时同步触发 normalizeCreditsState

#### BatchConfirmCard isKling 检测修复（ChatPanel.tsx）
- 新增 `modelHint` prop：从 `msg.data.selectedModel` 传入，不依赖 AI 返回的 task.model 来判断是否 Kling
- `sharedModel = modelHint || batchTasks[0]?.model || 'seedance2.0fast'`
- `forcedModel` 传递：批量任务提交时 `model: forcedModel || t.model || selectedModel`

#### 重新描述恢复素材（ChatPanel.tsx）
- `handleEditBatchConfirm()` / `handleEditKlingConfirm()`：重新描述时恢复原始 selectedFiles

#### 历史面板失败过滤修复（HistoryPanel.tsx）
- filterType === 'failed' 时正确过滤失败条目（之前漏了 else if 导致返回全部）

#### WorksPanel 改进（WorksPanel.tsx）
- `BatchQueueCard`：全部完成后隐藏（检查 hasActiveTasks）
- `SingleCardGrid`：支持 `highlighted` prop，滚动定位 + 高亮边框
- `QueueCard`：Kling statusMessage 优先显示（排队中 第N位）
- 下载按钮：优先用 `getOpenableLocalPath`，其次触发 `downloadTask`

#### 工具函数（src/utils/filePath.ts，新文件）
- `getOpenableLocalPath(localPath, filePath, resultUrl)` — 找最优本地可打开路径
- `isRemoteHttpUrl(url)` — 判断是否为远程 HTTP URL

---

### 积分系统分离 + 可灵链路修复（2026-04-15 完成，commit b5c690a）

#### 积分双字段架构
- `credits.balance` = VidClaw 平台积分（99,999 内部用户），**永远不被即梦数据覆盖**，localStorage 持久化
- `jimengBalance: number` = 即梦账号余额缓存（顶层 store 字段，不持久化，每次启动从 `checkCredits()` 拉取）
- `setJimengBalance(n)` 是唯一写 `jimengBalance` 的方法
- `SettingsPanel.fetchCredits()` 现在调 `setJimengBalance`，不再调 `syncBalance`

#### 确认卡积分展示规则（commit 4aa1cd5）
- **可灵模式（ConfirmCard / BatchConfirmCard / KlingConfirmCard）**：显示「⚡ 消耗 N 积分 | 余额 XX」，余额 = VidClaw 平台积分，不足时红色 + 禁用按钮。不显示即梦余额。
- **Seedance 模式（ConfirmCard / BatchConfirmCard）**：只显示「即梦账号余额 · N 积分」，不显示 VidClaw 积分（Seedance 不消耗平台积分）。

#### 时长 3s（可灵）
- `ConfirmCard` / `BatchConfirmCard`：`isKling` 时 DURATION_OPTIONS 从 3 开始（原来 4）

#### 批量任务"待提交"修复
- `handleConfirmBatch` 可灵分支提交后立即 `setBatchTasks([])`
- `BatchQueueCard` 读 `batchTasks`，清空后不再显示残留的 pending 子任务

#### 可灵并发控制（main.js）
- `klingQueue[]` + `klingRunning` + `KLING_MAX_CONCURRENT = 5`
- 超出并发上限时任务进入 `klingQueue`，通过 `kling-progress` 事件推送「排队中 第N位」
- 完成一个 → `drainKlingQueue()` 自动补下一个
- 进度/结果/失败事件逻辑不变，只是执行时机受控

---

### WorksPanel UI 全面重构（2026-04-16 完成，commits 54af4b5–1008c64）

#### 设计系统扩充（src/index.css）
- `@theme` 块新增 `--ease-enter: cubic-bezier(0.16, 1, 0.3, 1)` 和 `--ease-exit: cubic-bezier(0.4, 0, 1, 1)` 缓动变量
- 新增 `@keyframes progress-fill` 和 `.animate-progress-fill` 工具类

#### 队列卡样式（QueueCard / BatchQueueCard）
- 统一圆角 `rounded-xl`、发丝边框 `border-[rgba(255,255,255,0.08)]`、按压效果 `active:scale-[0.97]`、宽度约束 `max-w-[320px]`
- **状态指示**：用彩色圆点（`w-2 h-2 rounded-full`）替换 Loader2 / Clock 图标；生成中=`bg-brand animate-pulse`，排队=`bg-warning`，失败=`bg-error`
- **进度条**：`h-0.5`（更细），右侧同行显示百分比文本
- **BatchQueueCard Activity Rail**：完全移除展开/折叠按钮；≤3个子任务显示内联彩点+prompt截断；>3个任务显示可横向滚动的编号小方块，右侧 `maskImage` 渐隐

#### 作品卡样式（SingleCardGrid / SingleCardList / BatchCardGrid / BatchCardList）
- **SingleCardGrid**：`rounded-2xl`；信息（prompt + 模型标签 + 操作按钮）全部移入缩略图底部渐变叠层（`bg-gradient-to-t from-black/70 via-black/20 to-transparent`）；按钮常驻 `opacity-30`，悬停 `opacity-100`；删除改为二步确认（首次点击启动 3 秒倒计时，再次点击才删除）
- **SingleCardList**：`rounded-xl`；操作区常驻 `opacity-50`；同款删除二步倒计时
- **BatchCardGrid**：三层伪叠影效果（外层两个绝对定位 div，`translate(6px,6px)`/`translate(3px,3px)` + `scale(0.93)`/`scale(0.96)` + `opacity-30`/`opacity-60`），主卡片 `rounded-2xl` + `hover:-translate-y-0.5`
- **BatchCardList**：`rounded-xl`，`active:scale-[0.97]`，`rounded-lg` 图标容器

#### 全局布局改进（WorksPanel 主组件）
- **日期分组表头**：从旧的 badge 样式改为 `左标签 — flex-1 分割线 — 右数字` 格式（`h-px bg-[rgba(255,255,255,0.06)]`）
- **空状态**：图标容器放大至 `w-16 h-16 rounded-2xl`，Film 图标 32px，新增 CTA 按钮「去创作第一个视频」（派发 `navigate-to-chat` CustomEvent）

*最后更新：2026-04-16（WorksPanel UI 全面重构）*

---

### 可灵 O1 批量任务路由修复（2026-04-16 完成，commit 3e9d862）

**问题：** 可灵 O1 批量任务通过 `addTask()` 写入 `store.tasks`，导致在排队区显示为 N 个独立 `QueueCard`，完成后也是 N 个独立作品卡，而非统一的 `BatchQueueCard` + `BatchCardGrid`。

**修复：**
- `BatchTaskItem`（store.ts）新增 `submitId?: string` 字段
- `handleConfirmBatch()`（ChatPanel.tsx）可灵分支改为调用 `setBatchTasks()` + `setBatchInfo()`，不再用 `addTask()`
- `App.tsx` onProgress 三个事件（`kling-progress` / `result` / `failed`）优先检查 `batchTasks` 的 `submitId`；所有任务到达终态时自动写入 `batchHistory` 并清空 `batchTasks/batchInfo`

---

### 可灵模式文案修复（2026-04-16 完成，commits 2131a8a / f49a356 / 27e2bdc）

- **确认卡素材提示**（`ChatPanel.tsx` inline ConfirmCard + `chat/ConfirmCard.tsx`）：有素材且 `isKling` 时改为「📎 素材将提交给可灵 O1」，Seedance 侧不变
- **专业模式输入框 placeholder**（`ChatPanel.tsx`）：`sendMode === 'direct' && selectedModel === 'kling-o1'` 时显示「直接输入可灵提示词，按工具栏参数执行…」
- **专业模式确认按钮字号**（`ChatPanel.tsx` KlingConfirmCard）：`text-xs` → `text-[11px]`，防止文字撑出容器

*最后更新：2026-04-16（可灵模式文案 + 批量路由修复）*

---

### 排队卡片全面重设计 + WorksPanel 视觉优化（2026-04-16 完成，commit ad79f78）

#### QueueCard（`WorksPanel.tsx`）
- `max-w-[400px]`（原 320px）
- 4步状态管道：提交中 → 平台排队 → 生成中 → 已完成/下载中
- `getQueueStep(task)` 判断函数：`completed/downloaded→4`，`generating&&progress>0→3`，`queued→2`，其他→1
- Kling 初始 `status='generating', progress=0` → step 1（提交中），`progress>0` → step 3（生成中）
- 补充状态文字：Seedance 排队显示「队列第N位 / 共M位」，Kling 排队显示「内部队列第N位」，生成中显示 statusMessage
- 末步标签：`settings.autoDownload ? '下载中' : '已完成'`
- 素材缩略图：`w-10 h-10 rounded-md`，最多4个 + `+N` 溢出
- 详情 ›按钮：`onOpenDrawer(task)` prop

#### BatchQueueCard（`WorksPanel.tsx`）
- `max-w-[400px]`，新增 `onOpenDrawer: () => void` prop
- 并发状态行：运行中 N / 等待中 M / 已完成/下载中 N / 失败 N（失败为0时不显示）
- 子任务列表：运行中优先，最多3条，超出显示 `+ N 条`
- 整体进度条：`done / total`，详情 ›按钮

#### QueueDetailDrawer（新文件 `src/components/QueueDetailDrawer.tsx`）
- 右侧 `w-[360px]` 抽屉，`transition-transform duration-300`，`translate-x-full`→`translate-x-0`
- 半透明遮罩，点击遮罩关闭
- **单任务模式**：完整 prompt + 参数（模型/时长）+ 素材（80px 可点击）+ 状态记录（`useRef` 非持久化，status 变化时 push 新条目）
- **批量模式**：共用参数 + 全部任务列表（序号 + 状态点 + 完整 prompt）
- WorksPanel 通过 `drawerOpen/drawerTask/drawerIsBatch` 三个 state 控制，`handleOpenSingleDrawer/handleOpenBatchDrawer` 两个 callback

#### WorksPanel 卡片视觉优化（同 commit）
- Grid 容器：`items-start`（消除等高拉伸导致的空白黑区）
- `SingleCardGrid` 缩略图：`aspect-video → aspect-square`
- Overlay 渐变：`from-black/70 via-black/20 → from-black/85 via-black/40`，prompt 文字加 `textShadow: '0 1px 4px rgba(0,0,0,0.9)'`
- `FailedFooter` 组件：一行摘要（错误标题 + 重试 + 详情展开），替换原 `TaskErrorDisplay` 块
- 成功卡片 footer：模型·时长（左）+ 完成时间（右），`px-3 py-2`
- `BatchCardGrid` 缩略图 `aspect-square`，footer `p-3 → px-3 py-2.5`

*最后更新：2026-04-16（排队卡片重设计 + 作品卡视觉优化）*

---

### WorksPanel UX 全面打磨（2026-04-16 完成，commits 1d743a6–30354db）

#### 新增 IPC 通道（`electron/main.js` + `src/preload/preload.js` + `src/types/electron.d.ts` + `src/App.tsx`）
- `file:show-in-folder` → `window.api.showItemInFolder(path)`：在 Finder/Explorer 中高亮文件
- `file:save-as` → `window.api.saveFileAs({ srcPath, suggestedName })`：弹出保存对话框 + 复制文件
- `file:delete` → `window.api.deleteFile(path)`：删除本地文件（失败静默）

#### modelName 规范化（`WorksPanel.tsx`）
- `modelShort` 函数改名为 `modelName`，映射为完整名称：`Seedance 2.0 Fast` / `Seedance 2.0` / `Kling O1`
- 全场替换，覆盖 SingleCardGrid / SingleCardList / BatchCardGrid / BatchCardList / BatchDrawer / BatchQueueCard

#### SingleCardGrid 重构
- 外层 div 去掉 `overflow-hidden`；缩略图 div 承担 `overflow-hidden rounded-t-2xl`（FailedFooter 可自由展开）
- 信息区移至缩略图下方：prompt 2行 clamp + 模型·时长 + 日期（`px-3 pt-2.5 pb-1`）
- 原渐变叠层（prompt + 模型标签 + 操作按钮）全部删除
- 全卡片 onClick → 播放；操作按钮行常驻可见，`e.stopPropagation()`
- 悬停 overlay：`bg-black/0 group-hover:bg-black/40 transition-colors`，居中 Play 图标
- 删除改为内联确认条（`showDeleteConfirm` state），调用 `window.api.deleteFile(localPath)` 后再删记录
- 失败卡片确认文案：「删除任务记录？」

#### 下载按钮统一规则（SingleCardGrid / SingleCardList / BatchTaskRow）
- `autoDownload=true` + 有本地路径 → `showItemInFolder`，图标 `FolderOpen`
- `autoDownload=false` + 有本地路径 → `saveFileAs`，图标 `Download`
- 无本地路径但有 submitId/远程 URL → `downloadTask(id)`

#### SingleCardList 同步修复
- 倒计时删除改为内联确认条；下载按钮同款三路逻辑

#### BatchDrawer 改进
- 共享素材缩略图 `w-6 h-6` → `w-8 h-8`；图片 `window.api.openFile`，视频 `setPreviewUrl(toPlayable(path))`；hover 加 `ring-brand`
- `BatchTaskRow` 缩略图 `w-16 h-10`（16:9）→ `w-14 h-14`（1:1）
- `BatchTaskRow` 整行点击播放，操作按钮区 `e.stopPropagation()`
- 下载按钮：`autoDownload=true` → `showItemInFolder`；否则 → `saveFileAs`
- 删除记录改为内联确认条，逐个 `deleteFile(outputFile)` 后 `removeBatchHistory`

*最后更新：2026-04-16（WorksPanel UX 全面打磨）*
