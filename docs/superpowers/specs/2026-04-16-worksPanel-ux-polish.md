# WorksPanel UX 全面打磨 — Design Spec

**日期：** 2026-04-16  
**状态：** 已审批

---

## 目标

修复作品区五类已知问题：
1. SingleCardGrid 信息展示贫瘠，与 BatchCardGrid 风格不统一
2. 单任务卡片交互逻辑错误（点击无反应、下载行为有误、删除倒计时奇怪）
3. 模型名称全场不统一、使用缩写
4. BatchDrawer 素材不可预览、缩略图比例错误、点击逻辑混乱、删除无确认
5. 错误展示被 `overflow-hidden` 裁剪，无法显示完整内容

---

## 受影响文件

| 文件 | 操作 |
|------|------|
| `src/components/WorksPanel.tsx` | 主要修改（见下方各节） |
| `electron/main.js` | 新增三个 IPC handler |
| `src/App.tsx` | 新增三个 `window.api` 类型声明（或 `src/types/electron.d.ts`） |

---

## 设计详情

### 一、SingleCardGrid 结构重设计

#### 1.1 新卡片 JSX 结构

```
┌──────────────────────────────┐
│                              │  ← 缩略图区 (aspect-square)
│   悬停 → 居中播放按钮 (48px) │     此 div 负责 overflow-hidden + rounded-t-2xl
│  [5s] [已下载]               │  ← 角标保留（左上 absolute）
└──────────────────────────────┘
│ prompt 文字（2行 clamp）      │  ← px-3 pt-2.5 pb-1
│ Seedance 2.0 Fast · 5s      │  ← text-[11px] text-text-muted
│ 2026-04-16 14:32             │
├──────────────────────────────┤
│  [复制] [下载/文件夹] [删除] │  ← 操作行 px-3 pb-2.5，常驻可见
└──────────────────────────────┘
```

#### 1.2 关键变更

- **外层 `<div>` 去掉 `overflow-hidden`**，改由缩略图 `<div>` 自己承担 `overflow-hidden rounded-t-2xl`
- **全卡片 `onClick` → 直接播放**（`onPreview(playUrl)`），操作按钮内加 `e.stopPropagation()`
- **悬停 overlay**：缩略图上叠一层 `bg-black/0 group-hover:bg-black/40 transition`，居中显示 `Play size={40}` 图标（`opacity-0 group-hover:opacity-100`）
- **叠层完全移除**：原来的渐变层（prompt + model badge + action buttons）整体删除
- **失败态**：缩略图显示 AlertTriangle，下方由 `FailedFooter` 负责，无叠层
- `modelShort` → 见第三节，全部替换为 `modelName`

#### 1.3 操作行按钮布局

```tsx
<div className="flex items-center justify-end gap-1 px-3 pb-2.5">
  <button onClick copy>          {/* 复制提示词 */}
  <button onClick download>      {/* 下载 / 打开文件夹，见第二节 */}
  <button onClick delete>        {/* 删除，见第二节 */}
</div>
```

失败态的操作行：`[重试] [删除]`（无下载）

---

### 二、下载 + 删除交互逻辑

#### 2.1 下载按钮统一规则

适用范围：`SingleCardGrid`、`SingleCardList`、`BatchTaskRow`

| 条件 | 图标 | 点击行为 |
|------|------|---------|
| `autoDownload=true` AND 文件已在本地（`task.localPath` 或 `outputFile` 存在） | `FolderOpen` | `window.api.showItemInFolder(localPath)` |
| `autoDownload=false` AND 文件已在本地 | `Download` | `window.api.saveFileAs(localPath, suggestedName)` |
| 文件仅有远程 `resultUrl`，无本地路径 | `Download` | 调现有 `downloadTask(id)` |

`suggestedName` 生成规则：`${prompt前20字}_${model}_${duration}s.mp4`（非法字符替换为 `_`）

#### 2.2 删除确认（替换倒计时）

点击删除 → 卡片底部展开内联确认条（不弹模态框）：

```tsx
{/* 确认条 — showDeleteConfirm 为 true 时渲染 */}
<div className="flex items-center justify-between px-3 py-2 bg-error/10 border-t border-error/20">
  <span className="text-[11px] text-error">同时删除本地文件？</span>
  <div className="flex gap-2">
    <button onClick={() => setShowDeleteConfirm(false)}>取消</button>
    <button onClick={handleConfirmDelete}>删除</button>
  </div>
</div>
```

`handleConfirmDelete`：
1. 若 `task.localPath` 存在 → `window.api.deleteFile(task.localPath)`（失败静默处理）
2. `onDelete(task.id)` 删除记录

**SingleCardList** 同样改用此逻辑，去掉倒计时。

#### 2.3 BatchDrawer「删除记录」

- 底部「删除记录」按钮点击 → 展开抽屉内 inline 确认区
- 确认后：遍历 `record.tasks`，逐个 `window.api.deleteFile(t.outputFile)`（失败静默），然后 `removeBatchHistory(record.id)` + `onClose()`

---

### 三、模型名称规范化

将 `modelShort` 函数重命名为 `modelName`，映射改为：

```tsx
function modelName(m: string): string {
  const map: Record<string, string> = {
    'seedance2.0fast': 'Seedance 2.0 Fast',
    'seedance2.0':     'Seedance 2.0',
    'kling-o1':        'Kling O1',
  };
  return map[m] || m;
}
```

全局替换所有 `modelShort(` → `modelName(`，覆盖：
- `SingleCardGrid` footer
- `SingleCardList` 信息行
- `BatchCardGrid` footer
- `BatchCardList` 信息行
- `BatchDrawer` 参数条
- `BatchQueueCard` 角标（当前显示 `'Kling' : 'Seedance'`，改为 `modelName(batchTasks[0].model)`）

---

### 四、BatchDrawer 改进

#### 4.1 素材点击预览（共享参数条）

```tsx
// 图片
<button onClick={() => window.api.openFile(m.path)}>
  <img ... />
</button>

// 视频
<button onClick={() => setPreviewUrl(toPlayable(m.path))}>
  <video ... />
</button>
```

将 `w-6 h-6` 缩略图放大为 `w-8 h-8`，加 `cursor-pointer hover:ring-1 hover:ring-brand`。

#### 4.2 BatchTaskRow 缩略图 → 1:1

```diff
- <div className="w-16 h-10 rounded overflow-hidden ...">
+ <div className="w-14 h-14 rounded overflow-hidden ...">
```

#### 4.3 点击行直接播放

```tsx
<div
  onClick={() => playUrl && onPreview(playUrl)}
  className="cursor-pointer ..."
>
  ...操作按钮内加 e.stopPropagation()
</div>
```

#### 4.4 BatchTaskRow 下载按钮

同第二节 2.1 规则，`autoDownload=true` → `showItemInFolder(outputFile)`，否则 → `saveFileAs`。

#### 4.5 BatchDrawer 删除确认

见第二节 2.3。

---

### 五、错误展示修复

#### 5.1 外层卡片 `overflow-hidden` 处理

`SingleCardGrid` 外层 div：去掉 `overflow-hidden`，改为：

```tsx
<div className="group relative bg-surface-1 border rounded-2xl cursor-pointer ...">
  {/* 缩略图 */}
  <div className="aspect-square bg-surface-2 relative overflow-hidden rounded-t-2xl">
    ...
  </div>
  {/* FailedFooter 和 Footer 在此自由伸展 */}
```

#### 5.2 FailedFooter 展开内容

展开的 `parsed.message` 无高度限制，自然换行撑高卡片。`items-start` grid 确保不影响同行其他卡片。

---

### 六、新增 IPC Handlers（`electron/main.js`）

```js
// 在 Finder / 文件管理器中高亮选中文件
ipcMain.handle('file:show-in-folder', async (_event, filePath) => {
  const { shell } = require('electron');
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return { success: true };
  }
  return { success: false, error: '文件不存在' };
});

// 另存为：弹出保存对话框 + 复制文件
ipcMain.handle('file:save-as', async (_event, { srcPath, suggestedName }) => {
  const { dialog } = require('electron');
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: suggestedName,
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm'] }],
  });
  if (result.canceled || !result.filePath) return { success: false };
  await fs.promises.copyFile(srcPath, result.filePath);
  return { success: true, filePath: result.filePath };
});

// 删除本地文件（失败静默）
ipcMain.handle('file:delete', async (_event, filePath) => {
  try {
    if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
```

需同步在 `window.api` 类型声明中加入：
```ts
showItemInFolder: (filePath: string) => Promise<{ success: boolean; error?: string }>;
saveFileAs: (args: { srcPath: string; suggestedName: string }) => Promise<{ success: boolean; filePath?: string }>;
deleteFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
```

---

## 不改动的部分

- `BatchCardGrid` 三层叠影效果
- `SingleCardList` 布局（仅调整下载/删除交互逻辑，不改结构）
- `QueueCard` / `BatchQueueCard` / `QueueDetailDrawer`
- `VideoModal`、`TaskErrorDisplay` 组件本身

---

## 边界情况

- `task.localPath` 为空且 `resultUrl` 也为空（生成中被删除）：不渲染下载按钮
- `saveFileAs` 用户取消对话框：静默返回，不报错
- `deleteFile` 文件不存在：静默成功，记录照常删除
- 失败卡片无 `localPath`：确认条文案改为「删除任务记录？」（不提本地文件）
- `BatchDrawer` 部分任务无 `outputFile`（生成失败）：跳过该条 `deleteFile` 调用
