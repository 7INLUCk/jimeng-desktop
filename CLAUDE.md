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
  - `BatchQueueCard`：批量任务显示为**单个卡片**（与 `QueueCard` 相同尺寸/样式）
  - `QueueCard`：单任务（Kling / Seedance 单次）卡片
  - 无折叠上限，全部显示，父容器 `overflow-y-auto` 自然滚动
- **作品区**：已完成单任务 + 批量历史，按日期分组（今天/昨天/本周/更早）
- **视图切换**：网格 / 列表（右上角图标）

### BatchQueueCard 状态显示逻辑
```
isRunning 为 false → "已完成"（绿色）
activeTask.queueStatus === 'Queuing' → "排队第N位"（橙色 text-warning）
activeTask.queueStatus === 'Generating' → "生成中"（品牌色 text-brand）
其他 → "提交中"（品牌色 text-brand）
```

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
