# Skills UX 重设计 — 设计文档

## 目标

统一 4 种任务确认框的视觉语言，修复技能使用流程，让用户在任何确认框里都能一键保存当前配置为技能。改善 SkillEditor 内的素材预览体验。

## 架构

### 文件拆分

从 `src/components/ChatPanel.tsx`（当前 4512 行）里提取 4 个确认框组件，新增 1 个共享保存弹窗：

```
src/components/confirm/
  ConfirmCard.tsx          ← AI 单任务确认（原 ChatPanel 内 inline ConfirmCard）
  BatchConfirmCard.tsx     ← 批量任务确认（原 ChatPanel 内 inline BatchConfirmCard）
  KlingConfirmCard.tsx     ← 可灵直接确认（原 ChatPanel 内 inline KlingConfirmCard）
  SkillConfirmCard.tsx     ← 技能确认（原 ChatPanel 内 inline SkillConfirmCard）
  SaveSkillModal.tsx       ← 「保存为技能」弹窗，4 个卡共用
```

**ChatPanel.tsx** 只保留：输入框逻辑、消息列表渲染、发送/提交流程协调函数。各确认框的 JSX 和内部 state 迁移至各自文件，ChatPanel 通过 callback props 注入提交/取消等行为。

**SkillsPanel.tsx** 和 SkillEditor 组件保留在原文件，只改 SkillEditor 内部布局和素材预览。

---

## 确认框统一视觉设计

### 通用结构（4 个卡一致）

```
┌──────────────────────────────────────────┐
│ [图标] 标题                    [× 关闭]   │  header
├──────────────────────────────────────────┤
│ [模型 pill] [时长 pill] [比例 pill]        │  params 行
├──────────────────────────────────────────┤
│                                          │
│  Prompt 区（各卡差异见下）                │  内容区（flex-1, overflow-y-auto）
│                                          │
│  素材区（有素材时显示）                   │
│                                          │
├──────────────────────────────────────────┤
│ [保存为技能]          [取消]  [确认提交]   │  footer
└──────────────────────────────────────────┘
```

### Params 行

当前各卡用静态文字标签显示模型/时长/比例。改为**可点击循环切换的 pill**，和工具栏 PillSelect 同款交互逻辑：
- 模型 pill：循环切换 `seedance2.0fast → seedance2.0 → kling-o1`（Kling O1 时时长自动钳制到 5s/10s）
- 时长 pill：`4 → 5 → ... → 15`（Kling 模式：`5 → 10`）
- 比例 pill：`9:16 → 16:9 → 1:1 → 4:3`
- 用户在卡内调整完 params 后直接提交，无需关卡回工具栏重设

### 各卡 Prompt 区差异

| 卡 | Prompt 区 |
|---|---|
| ConfirmCard | 单个可编辑 textarea（AI 改写结果，用户可直接修改） |
| BatchConfirmCard | 可滚动任务列表，每条是独立可编辑 textarea |
| KlingConfirmCard | 单个可编辑 textarea + 「需要图片素材」必填提示 |
| SkillConfirmCard | 与 ConfirmCard/Batch 相同，prompt 来自 skill.tasks；header 标题显示技能名 |

### 素材区

- 图片：显示缩略图，点击触发 `setPreviewUrl` 打开 VideoModal 全览
- 视频：显示首帧缩略图（`<video preload="metadata">`） + hover 播放图标，点击触发 VideoModal
- 支持在卡内「+ 添加素材」和移除已有素材
- 卡内素材变更实时反映到提交参数（不影响工具栏 selectedFiles 状态）

---

## 技能使用新流程

### 当前流程（有问题）

```
SkillsPanel 点「使用」
  → setActiveSkill(skill) + setActivePanel('chat')
  → 用户手动在输入框发送消息
  → handleSkillSend() 才插入 skill-confirm 消息
```

### 新流程

```
SkillsPanel 点「使用」
  → setPendingSkillConfirm(skill)   ← 新 store action
  → setActivePanel('chat')

ChatPanel useEffect 监听 pendingSkillConfirm
  → 有值时，直接在消息流末尾 addMessage(skill-confirm 类型)
  → clearPendingSkillConfirm()      ← 用完即清
  → 无需用户发任何消息
```

### Store 变更

在 `src/store.ts` 新增：

```typescript
pendingSkillConfirm: Skill | null;          // 内存态，不持久化
setPendingSkillConfirm: (skill: Skill | null) => void;
```

`activeSkill` 字段保留（SkillConfirmCard 内部仍用它做「当前正在使用的技能」引用，用于 SaveSkillModal 预选）。`handleSkillSend()` 函数删除（流程不再需要它）。

---

## 保存为技能（SaveSkillModal）

### 触发入口

4 个确认框 footer 左侧均有「保存为技能」按钮。点击后弹出 `SaveSkillModal`，不关闭底层确认框。

### SaveSkillModal 结构

```
┌───────────────────────────────┐
│  保存为技能              [×]  │
│                               │
│  技能名称  [_______________]  │
│  描述      [_______________]  │
│                               │
│  ○ 新建技能                   │
│  ● 更新到现有技能  [下拉选择▾] │
│                               │
│                  [取消] [保存] │
└───────────────────────────────┘
```

- **新建技能**：调用 `addSkill()`，数据从当前确认框的 prompt/params/materials 构造
- **更新现有技能**：下拉列表展示所有已保存技能，选中后调用 `updateSkill(id, ...)`，并保存 prevVersion（支持撤销）
- **SkillConfirmCard 触发时**：默认选「更新到现有技能」并预选当前 skill.id
- **其他卡触发时**：默认选「新建技能」，技能名预填当前 prompt 前 20 字

### 数据构造规则

| 来源卡 | tasks | materialSlots |
|---|---|---|
| ConfirmCard | `[{ prompt: 当前 textarea 内容 }]` | 无（用户可在 SkillEditor 后续添加） |
| BatchConfirmCard | 所有 task textarea 内容 | 无 |
| KlingConfirmCard | `[{ prompt: 当前 textarea 内容 }]` | 无 |
| SkillConfirmCard | 当前编辑后的 skill.tasks | 保留 skill.materialSlots |

---

## SkillEditor 改进

**改动位置**：`src/components/SkillsPanel.tsx` 内的 `SkillEditor` 组件，不新建文件。

### 素材槽位预览

- 槽位有预设文件时，渲染缩略图而不只是文件名：
  - 图片：`<img>` 缩略图（`w-12 h-12 object-cover rounded`）
  - 视频：`<video preload="metadata">` 首帧 + 绝对定位 Play 图标
  - 点击图片/视频调用 `setPreviewUrl(localFileUrlSync(path))` 触发 VideoModal

### Prompt textarea

- 改为自动扩展高度：`rows` 不固定，使用 `min-h` + `resize-none` + `onInput` 动态调整高度
- 每个 prompt 最少显示 3 行，内容多时自动扩展至最多 10 行

### 视觉对齐

- SkillEditor 弹窗的 params 区（模型/时长/比例按钮）样式与新 confirm card params 行保持一致（同款 pill 样式）

---

## 不在本次范围内

- SkillsPanel 列表卡片的视觉改版（保留现有布局）
- 技能搜索 / 分类 / 排序功能
- 批量技能执行的任何新逻辑
- ChatPanel.tsx 除确认框外的其他重构
