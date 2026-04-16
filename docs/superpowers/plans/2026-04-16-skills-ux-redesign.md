# Skills UX 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify confirm card visual language, fix the skill use flow (click "使用" → SkillConfirmCard appears immediately with no intermediate step), add "保存为技能" to all 4 confirm cards via a shared SaveSkillModal, and improve SkillEditor material previews.

**Architecture:** Extract the 4 confirm cards from `ChatPanel.tsx` into `src/components/confirm/`. Add `VideoThumb` and `SaveSkillModal` as shared components in that folder. Cards own their params state via clickable pills (replacing hidden dropdowns). Add `pendingSkillConfirm` to store; ChatPanel useEffect watches it and auto-inserts `skill-confirm` messages without user action.

**Tech Stack:** React + TypeScript + Tailwind v4 (OKLCH CSS variables, no tailwind.config.js) + Zustand (`useStore` from `src/store.ts`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/components/confirm/VideoThumb.tsx` | Canvas-based video frame extraction (extracted from ChatPanel) |
| Create | `src/components/confirm/SaveSkillModal.tsx` | Save/update-skill modal, reads store internally |
| Create | `src/components/confirm/SkillConfirmCard.tsx` | Skill confirm card with editable prompts + clickable pills |
| Create | `src/components/confirm/ConfirmCard.tsx` | AI single-task confirm card with always-editable textarea + clickable pills |
| Create | `src/components/confirm/BatchConfirmCard.tsx` | Batch confirm card with clickable pills |
| Create | `src/components/confirm/KlingConfirmCard.tsx` | Kling O1 confirm card with editable prompt + clickable pills |
| Modify | `src/store.ts` | Add `pendingSkillConfirm: Skill \| null` + `setPendingSkillConfirm` |
| Modify | `src/components/SkillsPanel.tsx` | `handleUse` uses `setPendingSkillConfirm` instead of `setActiveSkill` + SkillEditor textarea + material previews |
| Modify | `src/components/ChatPanel.tsx` | Import extracted cards, delete `handleSkillSend`, add `pendingSkillConfirm` useEffect, update `handleApplySkill` |

---

## Task 1: VideoThumb + SaveSkillModal shared components

**Files:**
- Create: `src/components/confirm/VideoThumb.tsx`
- Create: `src/components/confirm/SaveSkillModal.tsx`

- [ ] **Step 1: Create VideoThumb.tsx** — extract verbatim from ChatPanel.tsx lines 765–851

```tsx
// src/components/confirm/VideoThumb.tsx
import { useState, useEffect, useRef } from 'react';
import { Video } from 'lucide-react';
import { localFileUrl } from '../../utils/localFile';

export function VideoThumb({ path, size = 48, onClick }: { path: string; size?: number; onClick?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const onMeta = () => {
      if (cancelled) return;
      if (isFinite(video.duration)) setDuration(video.duration);
      video.currentTime = Math.min(1, video.duration > 0 ? video.duration * 0.1 : 1);
    };

    const capture = () => {
      if (cancelled) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      try {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl && dataUrl !== 'data:,') setThumb(dataUrl);
      } catch (e) {
        console.warn('[VideoThumb] drawImage failed:', e);
      }
    };

    const onSeeked = () => {
      if (cancelled) return;
      requestAnimationFrame(capture);
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('seeked', onSeeked);

    localFileUrl(path).then(url => {
      if (cancelled) return;
      video.src = url;
      video.load();
    });

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
      video.src = '';
    };
  }, [path]);

  const fmt = (s: number) => s >= 60 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : `${Math.floor(s)}s`;

  return (
    <div className="relative w-full h-full" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      <video ref={videoRef} style={{ visibility: 'hidden', width: 0, height: 0, position: 'absolute' }} muted playsInline crossOrigin="anonymous" />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {thumb ? (
        <img src={thumb} className="w-full h-full object-cover" alt="" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-1">
          <Video size={size / 2.4} className="text-text-muted" />
        </div>
      )}
      {duration !== null && (
        <span className="absolute bottom-1 right-1 text-[9px] bg-black/75 text-white px-1 py-px rounded leading-none font-mono">
          {fmt(duration)}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create SaveSkillModal.tsx**

```tsx
// src/components/confirm/SaveSkillModal.tsx
import { useState } from 'react';
import { X, Zap } from 'lucide-react';
import { useStore, type Skill, type SkillTask } from '../../store';

interface SaveSkillModalProps {
  onClose: () => void;
  tasks: SkillTask[];
  model: string;
  duration: number;
  aspectRatio: string;
  materialSlots?: Array<{ type: 'image' | 'video' | 'audio'; path?: string }>;
  /** When opened from SkillConfirmCard: pre-select update mode + this skill */
  activeSkillId?: string;
}

export function SaveSkillModal({ onClose, tasks, model, duration, aspectRatio, materialSlots, activeSkillId }: SaveSkillModalProps) {
  const { skills, addSkill, updateSkill } = useStore();
  const defaultName = tasks[0]?.prompt?.slice(0, 20) || '新技能';
  const activeSkill = skills.find(s => s.id === activeSkillId);
  const [name, setName] = useState(activeSkill?.name || defaultName);
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'new' | 'update'>(activeSkillId ? 'update' : 'new');
  const [targetId, setTargetId] = useState(activeSkillId || skills[0]?.id || '');

  function handleSave() {
    if (mode === 'new') {
      addSkill({
        id: `skill_${Date.now()}`,
        name: name.trim() || defaultName,
        description,
        model,
        duration,
        aspectRatio,
        tasks,
        materialSlots: materialSlots || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usedCount: 0,
        type: tasks.length > 1 ? 'batch' : 'single',
      });
    } else {
      const target = skills.find(s => s.id === targetId);
      if (!target) return;
      updateSkill(targetId, {
        tasks,
        model,
        duration,
        aspectRatio,
        materialSlots: materialSlots ?? target.materialSlots,
        updatedAt: Date.now(),
        prevVersion: {
          tasks: target.tasks,
          model: target.model,
          duration: target.duration,
          aspectRatio: target.aspectRatio,
          updatedAt: target.updatedAt,
        },
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-surface-1 border border-border rounded-xl w-[380px] shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-brand" />
            <h3 className="text-sm font-semibold text-text-primary">保存为技能</h3>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('new')}
              className={`flex-1 py-2 text-xs rounded-lg transition-all ${mode === 'new' ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'}`}
            >
              新建技能
            </button>
            <button
              onClick={() => setMode('update')}
              disabled={skills.length === 0}
              className={`flex-1 py-2 text-xs rounded-lg transition-all disabled:opacity-40 ${mode === 'update' ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'}`}
            >
              更新现有技能
            </button>
          </div>

          {mode === 'new' ? (
            <>
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">技能名称</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">描述（可选）</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="简单描述这个技能的用途..."
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">选择要更新的技能</label>
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
              >
                {skills.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-text-disabled mt-1.5">更新后可在技能库中撤销</p>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs text-text-secondary bg-surface-2 hover:bg-border rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={mode === 'new' && !name.trim()}
            className="px-4 py-2 text-xs bg-brand hover:bg-brand/90 text-white rounded-lg transition-colors disabled:opacity-40"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/yuchuyang/.openclaw/workspace-alex/projects/jimeng-desktop
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: no errors in the new files (may see pre-existing errors elsewhere).

- [ ] **Step 4: Commit**

```bash
git add src/components/confirm/VideoThumb.tsx src/components/confirm/SaveSkillModal.tsx
git commit -m "feat: add shared VideoThumb and SaveSkillModal components"
```

---

## Task 2: Store + pendingSkillConfirm flow

**Files:**
- Modify: `src/store.ts`
- Modify: `src/components/SkillsPanel.tsx`
- Modify: `src/components/ChatPanel.tsx`

This task fixes the core skill-use flow: clicking "使用" in SkillsPanel immediately shows a SkillConfirmCard in the chat, without requiring the user to send a message first.

- [ ] **Step 1: Add pendingSkillConfirm to store.ts**

In the AppState interface (around line 372 where `setActiveSkill` is defined), add after `setActiveSkill`:

```typescript
// In the interface, after `setActiveSkill: (skill: Skill | null) => void;`
pendingSkillConfirm: Skill | null;
setPendingSkillConfirm: (skill: Skill | null) => void;
```

In the `create<AppState>` initial state (look for `activeSkill: null`), add alongside:

```typescript
pendingSkillConfirm: null,
```

In the actions section (look for `setActiveSkill: (skill) => set({ activeSkill: skill }),`), add:

```typescript
setPendingSkillConfirm: (skill) => set({ pendingSkillConfirm: skill }),
```

- [ ] **Step 2: Update SkillsPanel.tsx — handleUse**

At the top of SkillsPanel, add `setPendingSkillConfirm` to the useStore destructure. Find:
```typescript
const { skills, addSkill, updateSkill, deleteSkill, setActiveSkill, setActivePanel } = useStore();
```
Replace with:
```typescript
const { skills, addSkill, updateSkill, deleteSkill, setActiveSkill, setActivePanel, setPendingSkillConfirm } = useStore();
```

Find `handleUse` (line 482):
```typescript
function handleUse(skill: Skill) {
  updateSkill(skill.id, { usedCount: skill.usedCount + 1 });
  setActiveSkill(skill);
  setActivePanel('chat');
}
```
Replace with:
```typescript
function handleUse(skill: Skill) {
  updateSkill(skill.id, { usedCount: skill.usedCount + 1 });
  setPendingSkillConfirm(skill);
  setActivePanel('chat');
}
```

- [ ] **Step 3: Update ChatPanel.tsx — add pendingSkillConfirm useEffect**

Find the destructure of useStore in ChatPanel (the large one with `messages, addMessage, ...`). Add `pendingSkillConfirm, setPendingSkillConfirm` to it.

Below the existing useEffect blocks (and before the return statement), add this new useEffect:

```typescript
// Auto-insert skill-confirm card when SkillsPanel triggers a skill
useEffect(() => {
  if (!pendingSkillConfirm) return;
  const skill = pendingSkillConfirm;
  setPendingSkillConfirm(null);
  addMessage({
    id: Date.now().toString(),
    role: 'user',
    content: `[应用技能] ${skill.name}`,
    timestamp: new Date(),
  });
  setGuidedStep('task-confirming');
  addMessage({
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    type: 'skill-confirm',
    data: { skill, initialFiles: [] },
  });
}, [pendingSkillConfirm]);
```

- [ ] **Step 4: Update ChatPanel.tsx — fix handleApplySkill**

Find `handleApplySkill` (around line 2639):
```typescript
function handleApplySkill(skill: Skill) {
  setShowSkillPicker(false);
  setActiveSkill(skill);
  // Pre-fill params
  setSelectedModel(skill.model);
  setSelectedDuration(skill.duration);
  setSelectedRatio(skill.aspectRatio);
}
```
Replace with:
```typescript
function handleApplySkill(skill: Skill) {
  setShowSkillPicker(false);
  addMessage({
    id: Date.now().toString(),
    role: 'user',
    content: `[应用技能] ${skill.name}`,
    timestamp: new Date(),
    ...(selectedFiles.length > 0 && {
      data: {
        materials: selectedFiles.map((f, idx) => {
          const type = getFileType(f);
          return { type, name: `${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}${idx + 1}`, path: f };
        }),
      },
    }),
  });
  setGuidedStep('task-confirming');
  addMessage({
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    type: 'skill-confirm',
    data: { skill, initialFiles: [...selectedFiles] },
  });
  setSelectedFiles([]);
}
```

- [ ] **Step 5: Delete handleSkillSend from ChatPanel.tsx**

Find `handleSkillSend` (around line 2648) and delete the entire function (lines 2648–2678).

Then search for any call to `handleSkillSend()` in the file (the summary says it's called at line 1834 inside `handleSend`). Delete that call site. The `if (activeSkill) { handleSkillSend(); return; }` or similar block.

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

Expected: no errors in the modified files.

- [ ] **Step 7: Restart Electron and test**

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; lsof -ti:5174 | xargs kill -9 2>/dev/null; pkill -f "electron" 2>/dev/null; npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 8 && tail -20 /tmp/electron-dev.log
```

Verify:
1. Go to Skills panel → click "使用" on any skill → app switches to Chat panel AND a SkillConfirmCard appears immediately (no send needed)
2. In Chat panel → click skill picker (⚡ button in toolbar if visible) → apply a skill → same immediate confirm behavior

- [ ] **Step 8: Commit**

```bash
git add src/store.ts src/components/SkillsPanel.tsx src/components/ChatPanel.tsx
git commit -m "feat: add pendingSkillConfirm flow — 使用技能直接显示确认卡"
```

---

## Task 3: Extract SkillConfirmCard

**Files:**
- Create: `src/components/confirm/SkillConfirmCard.tsx`
- Modify: `src/components/ChatPanel.tsx` (remove inline definition, add import)

New SkillConfirmCard adds: editable prompt textareas (was read-only), clickable param pills (model/duration/ratio cycling), "保存为技能" footer button opening SaveSkillModal.

- [ ] **Step 1: Create SkillConfirmCard.tsx**

```tsx
// src/components/confirm/SkillConfirmCard.tsx
import { useState } from 'react';
import { X, CheckCircle, Plus, AlertTriangle, Play, Zap } from 'lucide-react';
import { useStore, type Skill, type SkillTask } from '../../store';
import { localFileUrlSync, getFileType } from '../../utils/localFile';
import { VideoThumb } from './VideoThumb';
import { SaveSkillModal } from './SaveSkillModal';

// Helper: cycle to next value in list
function cyclePill<T>(current: T, options: T[]): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

const MODEL_OPTIONS = ['kling-o1', 'seedance2.0fast', 'seedance2.0'] as const;
const MODEL_LABELS: Record<string, string> = {
  'kling-o1': 'Kling O1',
  'seedance2.0fast': 'Seedance Fast',
  'seedance2.0': 'Seedance 2.0',
};
const RATIO_OPTIONS = ['9:16', '16:9', '1:1', '4:3'];

function durationOptions(model: string) {
  return model === 'kling-o1' ? [5, 10] : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
}

interface SkillMaterialSlot {
  type: 'image' | 'video' | 'audio';
  path?: string;
}

export function SkillConfirmCard({
  msgId, skill, initialFiles, onConfirmTask, onConfirmBatch, onCancel,
}: {
  msgId: string;
  skill: Skill;
  initialFiles: string[];
  onConfirmTask: (files: string[], skill: Skill) => void;
  onConfirmBatch: (files: string[], skill: Skill) => void;
  onCancel: (msgId: string) => void;
}) {
  const setPreviewUrl = useStore(s => s.setPreviewUrl);
  const slots: SkillMaterialSlot[] = skill.materialSlots || [];
  const isBatch = skill.type === 'batch' && skill.tasks.length > 1;

  // Local params state (initially from skill)
  const [model, setModel] = useState(skill.model);
  const [duration, setDuration] = useState(skill.duration);
  const [aspectRatio, setAspectRatio] = useState(skill.aspectRatio);

  // Local editable prompts
  const [taskPrompts, setTaskPrompts] = useState<string[]>(skill.tasks.map(t => t.prompt));

  // Slot files
  const [slotFiles, setSlotFiles] = useState<(string | null)[]>(() => {
    const remaining = [...initialFiles];
    return slots.map(slot => {
      const idx = remaining.findIndex(f => getFileType(f) === slot.type);
      if (idx >= 0) return remaining.splice(idx, 1)[0];
      return slot.path ?? null;
    });
  });

  const [extraFiles, setExtraFiles] = useState<string[]>(() => {
    const usedSet = new Set<string>();
    const remaining = [...initialFiles];
    slots.forEach(slot => {
      const idx = remaining.findIndex(f => getFileType(f) === slot.type);
      if (idx >= 0) usedSet.add(remaining.splice(idx, 1)[0]);
    });
    return initialFiles.filter(f => !usedSet.has(f));
  });

  const [changedSlots, setChangedSlots] = useState<Set<number>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);

  const hasEmpty = slots.length > 0 && slotFiles.some(f => f === null);
  const allFiles = [...(slotFiles.filter(Boolean) as string[]), ...extraFiles];

  // Clamp duration when model changes
  function handleModelCycle() {
    const next = cyclePill(model, [...MODEL_OPTIONS]);
    setModel(next);
    if (next === 'kling-o1' && ![5, 10].includes(duration)) setDuration(5);
  }

  function handleDurationCycle() {
    const opts = durationOptions(model);
    setDuration(cyclePill(duration, opts));
  }

  function handleRatioCycle() {
    setAspectRatio(cyclePill(aspectRatio, RATIO_OPTIONS));
  }

  async function handleFillSlot(index: number) {
    const { files } = await window.api.selectFiles();
    if (!files?.length) return;
    const wasEmpty = slotFiles[index] === null;
    setSlotFiles(prev => { const next = [...prev]; next[index] = files[0]; return next; });
    if (!wasEmpty) setChangedSlots(prev => new Set([...prev, index]));
  }

  async function handleAddExtra() {
    const { files } = await window.api.selectFiles();
    if (!files?.length) return;
    setExtraFiles(prev => [...prev, ...files]);
  }

  function buildSubmitSkill(): Skill {
    const updatedTasks: SkillTask[] = skill.tasks.map((t, i) => ({
      ...t,
      prompt: taskPrompts[i] ?? t.prompt,
    }));
    return { ...skill, model, duration, aspectRatio, tasks: updatedTasks };
  }

  function handleConfirm() {
    const submitSkill = buildSubmitSkill();
    if (isBatch) {
      onConfirmBatch(allFiles, submitSkill);
    } else {
      onConfirmTask(allFiles, submitSkill);
    }
  }

  const hasChanges = changedSlots.size > 0 || extraFiles.length > 0;
  const currentTasksForSave: SkillTask[] = skill.tasks.map((t, i) => ({
    ...t,
    prompt: taskPrompts[i] ?? t.prompt,
  }));

  return (
    <>
      <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
        <div className="h-px bg-brand" />
        <div className="p-4 space-y-3.5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-brand font-medium flex items-center gap-1.5">
              <Zap size={12} /> 技能 · {skill.name}
            </p>
          </div>

          {/* Params pills (clickable cycling) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleModelCycle}
              className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors"
              title="点击切换模型"
            >
              {MODEL_LABELS[model] || model}
            </button>
            <button
              onClick={handleDurationCycle}
              className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors"
              title="点击切换时长"
            >
              {duration}s
            </button>
            <button
              onClick={handleRatioCycle}
              className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors"
              title="点击切换比例"
            >
              {aspectRatio}
            </button>
          </div>

          {/* Material Slots */}
          {slots.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">素材槽位</p>
              <div className="flex flex-wrap items-end gap-3">
                {slots.map((slot, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => handleFillSlot(i)}
                      className="w-14 h-14 rounded-xl overflow-hidden border border-border hover:border-brand transition-all relative"
                    >
                      {slotFiles[i] ? (
                        slot.type === 'image' ? (
                          <img src={localFileUrlSync(slotFiles[i]!)} className="w-full h-full object-cover" alt="" />
                        ) : slot.type === 'video' ? (
                          <VideoThumb path={slotFiles[i]!} size={28} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
                            <span className="text-purple-400">♪</span>
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-surface-3">
                          <Plus size={14} className="text-text-muted" />
                          <span className="text-[8px] text-text-muted">{slot.type === 'image' ? '图片' : slot.type === 'video' ? '视频' : '音频'}</span>
                        </div>
                      )}
                      {changedSlots.has(i) && (
                        <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-warning" />
                      )}
                    </button>
                  </div>
                ))}
                {extraFiles.map((f, i) => {
                  const fileType = getFileType(f);
                  return (
                    <div key={i} className="relative flex flex-col items-center gap-1">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-border">
                        {fileType === 'image' ? (
                          <img src={localFileUrlSync(f)} className="w-full h-full object-cover" alt="" />
                        ) : fileType === 'video' ? (
                          <VideoThumb path={f} size={28} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
                            <span className="text-purple-400 text-base">♪</span>
                          </div>
                        )}
                        <button
                          onClick={() => setExtraFiles(prev => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-surface-3 border border-border flex items-center justify-center hover:bg-error/80 hover:border-error transition-all"
                        >
                          <X size={7} className="text-text-muted" />
                        </button>
                      </div>
                      <span className="text-[9px] text-text-muted">额外</span>
                    </div>
                  );
                })}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={handleAddExtra}
                    className="w-14 h-14 rounded-xl border-2 border-dashed border-border hover:border-brand flex flex-col items-center justify-center gap-0.5 transition-all"
                  >
                    <Plus size={14} className="text-text-muted" />
                    <span className="text-[8px] text-text-muted">更多</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasChanges && (
            <div className="flex items-start gap-2 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
              <AlertTriangle size={12} className="text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning leading-snug">素材已修改，效果可能与上次不同</p>
            </div>
          )}

          {/* Editable Prompts */}
          {!isBatch ? (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">提示词</p>
              <textarea
                value={taskPrompts[0] || ''}
                onChange={e => setTaskPrompts([e.target.value])}
                className="w-full bg-surface-3 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary leading-relaxed resize-none outline-none focus:border-brand transition-colors"
                rows={3}
              />
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">批量任务 ({skill.tasks.length} 条)</p>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {taskPrompts.map((prompt, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded shrink-0 mt-1.5">#{i + 1}</span>
                    <textarea
                      value={prompt}
                      onChange={e => {
                        const next = [...taskPrompts];
                        next[i] = e.target.value;
                        setTaskPrompts(next);
                      }}
                      className="flex-1 bg-surface-3 border border-border-subtle rounded-md px-2.5 py-2 text-xs text-text-primary resize-none outline-none focus:border-brand transition-colors"
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-0.5">
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-text-muted hover:text-brand hover:bg-brand/10 rounded-md transition-all border border-border-subtle hover:border-brand/30"
            >
              <Zap size={11} /> 保存为技能
            </button>
            <div className="flex-1" />
            <button
              onClick={() => onCancel(msgId)}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all"
            >
              <X size={14} /> 取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={hasEmpty}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0"
            >
              <CheckCircle size={14} /> 确认提交
            </button>
          </div>
          {hasEmpty && (
            <p className="text-[10px] text-warning">请填充所有槽位后再提交</p>
          )}
        </div>
      </div>

      {showSaveModal && (
        <SaveSkillModal
          onClose={() => setShowSaveModal(false)}
          tasks={currentTasksForSave}
          model={model}
          duration={duration}
          aspectRatio={aspectRatio}
          materialSlots={skill.materialSlots}
          activeSkillId={skill.id}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update ChatPanel.tsx — replace inline SkillConfirmCard**

At the top of ChatPanel.tsx, add import:
```typescript
import { SkillConfirmCard } from './confirm/SkillConfirmCard';
```

Find the inline `function SkillConfirmCard(...)` definition (around line 3716) and delete it entirely (through the closing `}` around line 3904).

Also delete the inline `SkillMaterialSlot` component (typically just before SkillConfirmCard — search for `function SkillMaterialSlot`).

The `MessageBubble` usage of `<SkillConfirmCard ...>` at ~line 4312 stays unchanged.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

- [ ] **Step 4: Restart and test**

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; lsof -ti:5174 | xargs kill -9 2>/dev/null; pkill -f "electron" 2>/dev/null; npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 8
```

Verify: skills panel → "使用" → Chat panel shows SkillConfirmCard with editable prompts + clickable pills + "保存为技能" button.

- [ ] **Step 5: Commit**

```bash
git add src/components/confirm/SkillConfirmCard.tsx src/components/ChatPanel.tsx
git commit -m "feat: extract SkillConfirmCard with editable prompts and clickable param pills"
```

---

## Task 4: Extract ConfirmCard

**Files:**
- Create: `src/components/confirm/ConfirmCard.tsx`
- Modify: `src/components/ChatPanel.tsx`

New ConfirmCard: always-editable prompt textarea (no toggle), clickable pills replacing the hidden "修改参数" dropdown, "保存为技能" footer button.

- [ ] **Step 1: Create ConfirmCard.tsx**

```tsx
// src/components/confirm/ConfirmCard.tsx
import { useState } from 'react';
import { CheckCircle, RefreshCw, Zap, Play, X } from 'lucide-react';
import { useStore } from '../../store';
import { localFileUrlSync } from '../../utils/localFile';
import { VideoThumb } from './VideoThumb';
import { SaveSkillModal } from './SaveSkillModal';

function cyclePill<T>(current: T, options: T[]): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

const MODEL_OPTIONS = [
  { value: 'kling-o1',        label: 'Kling O1' },
  { value: 'seedance2.0fast', label: 'Seedance Fast' },
  { value: 'seedance2.0',     label: 'Seedance 2.0' },
];

const RATIO_OPTIONS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const KLING_RATIO_OPTIONS = ['9:16', '16:9', '1:1'];

interface MaterialItem {
  type: string;
  name: string;
  path: string;
  description?: string;
}

export function ConfirmCard({
  task, onConfirm, onEdit, hasFiles, selectedModel, selectedDuration, selectedRatio,
  materials, onDurationChange, onRatioChange, onModelChange, onEditMaterial,
}: {
  task: any;
  onConfirm: (editedPrompt?: string) => void;
  onEdit: () => void;
  hasFiles?: boolean;
  selectedModel?: string;
  selectedDuration?: number;
  selectedRatio?: string;
  materials?: { images: MaterialItem[]; videos: MaterialItem[]; audios: MaterialItem[] };
  onDurationChange?: (d: number) => void;
  onRatioChange?: (r: string) => void;
  onModelChange?: (m: string) => void;
  onEditMaterial?: (index: number, newDesc: string) => void;
}) {
  const [editedPrompt, setEditedPrompt] = useState<string>(task.prompt || '');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const setPreviewUrl = useStore(s => s.setPreviewUrl);
  const { credits, jimengBalance } = useStore();
  const isKling = selectedModel === 'kling-o1';
  const klingCost = isKling ? (selectedDuration ?? 5) * 10 : 0;
  const canAfford = !isKling || credits.balance >= klingCost;

  const currentModelLabel = MODEL_OPTIONS.find(m => m.value === selectedModel)?.label ?? 'Seedance Fast';
  const durations = isKling ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const ratios = isKling ? KLING_RATIO_OPTIONS : RATIO_OPTIONS;
  const modelValues = MODEL_OPTIONS.map(m => m.value);

  function handleModelCycle() {
    const next = cyclePill(selectedModel ?? 'seedance2.0fast', modelValues);
    onModelChange?.(next);
    // Clamp duration when switching to kling
    if (next === 'kling-o1' && selectedDuration !== undefined && ![3,4,5,6,7,8,9,10,11,12,13,14,15].includes(selectedDuration)) {
      onDurationChange?.(5);
    }
  }

  function handleDurationCycle() {
    onDurationChange?.(cyclePill(selectedDuration ?? 5, durations));
  }

  function handleRatioCycle() {
    onRatioChange?.(cyclePill(selectedRatio ?? '9:16', ratios));
  }

  const allMaterials = [
    ...(materials?.images || []),
    ...(materials?.videos || []),
    ...(materials?.audios || []),
  ];

  return (
    <>
      <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
        <div className="h-px bg-brand flex-shrink-0" />
        <div className="p-4">
          {/* Header */}
          <p className="text-xs text-brand font-medium flex items-center gap-1.5 mb-3">
            <span>✨</span> AI 优化后的提示词
          </p>

          {/* Always-editable prompt */}
          <textarea
            value={editedPrompt}
            onChange={e => setEditedPrompt(e.target.value)}
            className="w-full bg-surface-3 border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary leading-relaxed resize-none outline-none focus:border-brand mb-2 transition-colors"
            rows={4}
          />

          {/* AI reason */}
          {task.reason && (
            <p className="text-xs text-text-secondary mb-3 bg-surface-3 rounded-md px-3 py-2">
              💡 <span className="font-medium">改写理由：</span>{task.reason}
            </p>
          )}

          {/* Material thumbnails */}
          {allMaterials.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">已上传素材</p>
              <div className="flex flex-wrap gap-2">
                {allMaterials.map((m, i) => {
                  const isImg = m.type === 'image';
                  const isVid = m.type === 'video';
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {isImg && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-3">
                          <img src={localFileUrlSync(m.path)} alt={m.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      {isVid && (
                        <button
                          onClick={() => setPreviewUrl(localFileUrlSync(m.path))}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-brand transition-all relative"
                        >
                          <VideoThumb path={m.path} size={40} />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                              <Play size={9} className="text-white ml-0.5" />
                            </div>
                          </div>
                        </button>
                      )}
                      {!isImg && !isVid && (
                        <div className="w-16 h-16 rounded-lg border border-border bg-surface-3 flex items-center justify-center">
                          <span className="text-purple-400 text-lg">♪</span>
                        </div>
                      )}
                      <span className="text-[9px] text-text-muted max-w-[64px] truncate text-center">{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clickable param pills */}
          <div className="flex items-center gap-1.5 flex-wrap mb-4">
            <button onClick={handleModelCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换模型">
              {currentModelLabel}
            </button>
            <button onClick={handleDurationCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换时长">
              {selectedDuration ?? 5}s
            </button>
            <button onClick={handleRatioCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换比例">
              {selectedRatio ?? '9:16'}
            </button>
          </div>

          {hasFiles && (
            <p className="text-[10px] text-text-muted mb-3">
              {isKling ? '📎 素材将提交给可灵 O1' : '📎 素材将随任务一起提交给即梦 CLI'}
            </p>
          )}

          {/* Credit row */}
          {isKling ? (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
              <div className="flex items-center gap-1.5">
                <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
                <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>消耗 {klingCost} 积分</span>
              </div>
              <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
                余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg mb-3 bg-surface-3">
              <span className="text-[10px] text-text-muted">即梦账号余额</span>
              <span className="text-[10px] text-text-secondary font-medium">{jimengBalance.toLocaleString()} 积分</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onConfirm(editedPrompt)}
              disabled={!canAfford}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-150 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white hover:-translate-y-0.5"
            >
              <CheckCircle size={14} /> 确认提交
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all duration-150"
            >
              <RefreshCw size={14} /> 重新描述
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-text-muted hover:text-brand hover:bg-brand/10 rounded-md transition-all border border-border-subtle hover:border-brand/30"
            >
              <Zap size={11} /> 保存为技能
            </button>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <SaveSkillModal
          onClose={() => setShowSaveModal(false)}
          tasks={[{ prompt: editedPrompt }]}
          model={selectedModel ?? 'seedance2.0fast'}
          duration={selectedDuration ?? 5}
          aspectRatio={selectedRatio ?? '9:16'}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update ChatPanel.tsx — replace inline ConfirmCard**

Add import at top:
```typescript
import { ConfirmCard } from './confirm/ConfirmCard';
```

Delete the inline `function ConfirmCard(...)` definition (lines 1115–1386 in the original file). The `MessageBubble` call site at line ~4260 that renders `<ConfirmCard ...>` stays — it uses the same props.

Also remove the old `onSaveAsSkill` and `onUpdateSkill` props from the `<ConfirmCard>` usage in `MessageBubble` (lines ~4260–4280), since the extracted card handles this internally. The MessageBubble no longer needs to pass those props to ConfirmCard.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

- [ ] **Step 4: Restart and test**

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; lsof -ti:5174 | xargs kill -9 2>/dev/null; pkill -f "electron" 2>/dev/null; npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 8
```

Verify: submit a task → confirm card shows with always-editable textarea + clickable pills + "保存为技能" in footer.

- [ ] **Step 5: Commit**

```bash
git add src/components/confirm/ConfirmCard.tsx src/components/ChatPanel.tsx
git commit -m "feat: extract ConfirmCard with always-editable textarea and clickable param pills"
```

---

## Task 5: Extract BatchConfirmCard

**Files:**
- Create: `src/components/confirm/BatchConfirmCard.tsx`
- Modify: `src/components/ChatPanel.tsx`

New BatchConfirmCard: replace "修改参数" dropdown with clickable pills, add SaveSkillModal.

- [ ] **Step 1: Create BatchConfirmCard.tsx**

```tsx
// src/components/confirm/BatchConfirmCard.tsx
import { useState } from 'react';
import { X, CheckCircle, Layers, Zap, Play, Plus } from 'lucide-react';
import { useStore } from '../../store';
import { localFileUrlSync } from '../../utils/localFile';
import { VideoThumb } from './VideoThumb';
import { SaveSkillModal } from './SaveSkillModal';

function cyclePill<T>(current: T, options: T[]): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

const MODEL_OPTIONS = [
  { value: 'kling-o1',        label: 'Kling O1' },
  { value: 'seedance2.0fast', label: 'Seedance Fast' },
  { value: 'seedance2.0',     label: 'Seedance 2.0' },
];
const RATIO_OPTIONS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
const KLING_RATIO_OPTIONS = ['9:16', '16:9', '1:1'];

interface MaterialItem {
  type: string;
  name: string;
  path: string;
}

interface BatchTaskItem {
  id: string;
  index: number;
  prompt: string;
  reason?: string;
  expectedEffect?: string;
  materials: any[];
  duration: number;
  aspectRatio: string;
  model: string;
  status: string;
  submitId?: string;
}

export function BatchConfirmCard({
  batchName, description, materials, modelHint, onConfirm, onEdit,
}: {
  batchName: string;
  description: string;
  materials: MaterialItem[];
  modelHint?: string;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const { batchTasks, setBatchTasks, credits, jimengBalance, setPreviewUrl } = useStore();
  const [showSaveModal, setShowSaveModal] = useState(false);

  const sharedModel = modelHint || batchTasks[0]?.model || 'seedance2.0fast';
  const sharedDuration = batchTasks[0]?.duration || 5;
  const sharedRatio = batchTasks[0]?.aspectRatio || '9:16';
  const isKling = sharedModel === 'kling-o1';

  const durations = isKling ? [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const ratios = isKling ? KLING_RATIO_OPTIONS : RATIO_OPTIONS;
  const modelValues = MODEL_OPTIONS.map(m => m.value);
  const currentModelLabel = MODEL_OPTIONS.find(m => m.value === sharedModel)?.label || 'Seedance Fast';

  const klingTotalCost = isKling ? batchTasks.reduce((sum, t) => sum + (t.duration * 10), 0) : 0;
  const canAfford = !isKling || credits.balance >= klingTotalCost;

  function updateSharedParam(key: 'model' | 'duration' | 'aspectRatio', value: any) {
    setBatchTasks(batchTasks.map(t => ({ ...t, [key]: value })));
  }

  function handleModelCycle() {
    const next = cyclePill(sharedModel, modelValues);
    updateSharedParam('model', next);
    if (next === 'kling-o1' && sharedDuration < 3) updateSharedParam('duration', 5);
  }

  function handleDurationCycle() {
    updateSharedParam('duration', cyclePill(sharedDuration, durations));
  }

  function handleRatioCycle() {
    updateSharedParam('aspectRatio', cyclePill(sharedRatio, ratios));
  }

  function updatePrompt(index: number, prompt: string) {
    const updated = [...batchTasks];
    updated[index] = { ...updated[index], prompt };
    setBatchTasks(updated);
  }

  function deleteTask(index: number) {
    setBatchTasks(batchTasks.filter((_, i) => i !== index));
  }

  function addTask() {
    if (isKling) return;
    const newTask: BatchTaskItem = {
      id: `task_${Date.now()}_add`,
      index: batchTasks.length,
      prompt: '',
      reason: '',
      materials: batchTasks[0]?.materials || [],
      expectedEffect: '',
      duration: sharedDuration,
      aspectRatio: sharedRatio,
      model: sharedModel,
      status: 'pending',
    };
    setBatchTasks([...batchTasks, newTask]);
  }

  const hasEmptyPrompts = batchTasks.some(t => !t.prompt.trim());
  const saveTasksForSkill = batchTasks.map(t => ({ prompt: t.prompt }));

  return (
    <>
      <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[90%] animate-fade-in-up">
        <div className="h-px bg-brand flex-shrink-0" />
        <div className="p-4 max-h-[600px] overflow-y-auto space-y-4">

          {/* Header */}
          <div>
            <p className="text-xs text-accent font-medium mb-1.5 flex items-center gap-1.5">
              <Layers size={12} /> 批量任务确认
            </p>
            <p className="text-sm text-text-primary font-medium">{batchName}</p>
            {description && <p className="text-xs text-text-secondary mt-0.5">{description}</p>}
          </div>

          {/* Shared params — clickable pills */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">所有任务共用</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={handleModelCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换模型">
                {currentModelLabel}
              </button>
              <button onClick={handleDurationCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换时长">
                {sharedDuration}s
              </button>
              <button onClick={handleRatioCycle} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换比例">
                {sharedRatio}
              </button>
            </div>
          </div>

          {/* Materials */}
          {materials.length > 0 && (
            <div>
              <p className="text-[10px] text-text-muted mb-1.5">参考素材</p>
              <div className="flex flex-wrap gap-2">
                {materials.map((m, i) => {
                  const isImg = m.type === 'image';
                  const isVid = m.type === 'video';
                  return (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {isImg && (
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-surface-2">
                          <img src={localFileUrlSync(m.path)} alt={m.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      {isVid && (
                        <button onClick={() => setPreviewUrl(localFileUrlSync(m.path))} className="w-14 h-14 rounded-lg overflow-hidden border border-border hover:border-brand transition-all relative">
                          <VideoThumb path={m.path} size={28} />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                              <Play size={9} className="text-white ml-0.5" />
                            </div>
                          </div>
                        </button>
                      )}
                      {!isImg && !isVid && (
                        <div className="w-14 h-14 rounded-lg border border-border bg-surface-3 flex items-center justify-center">
                          <span className="text-purple-400">♪</span>
                        </div>
                      )}
                      <span className="text-[9px] text-text-muted max-w-[56px] truncate text-center">{m.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Credit row */}
          {isKling ? (
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
              <div className="flex items-center gap-1.5">
                <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
                <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>消耗 {klingTotalCost} 积分</span>
              </div>
              <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
                余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-3">
              <span className="text-[10px] text-text-muted">即梦账号余额</span>
              <span className="text-[10px] text-text-secondary font-medium">{jimengBalance.toLocaleString()} 积分</span>
            </div>
          )}

          {/* Task list (editable) */}
          <div className="space-y-2">
            {batchTasks.map((task, i) => (
              <div key={task.id} className="bg-surface-3 rounded-md border border-border-subtle overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded shrink-0">#{i + 1}</span>
                    {task.expectedEffect && <span className="text-[11px] text-text-secondary truncate">{task.expectedEffect}</span>}
                  </div>
                  <button onClick={() => deleteTask(i)} className="w-5 h-5 rounded flex items-center justify-center text-text-muted hover:text-error hover:bg-error/10 transition-all" title="删除此条">
                    <X size={12} />
                  </button>
                </div>
                <textarea
                  value={task.prompt}
                  onChange={e => updatePrompt(i, e.target.value)}
                  placeholder="输入这条任务的提示词..."
                  className="w-full bg-transparent px-3 py-2.5 text-xs text-text-primary leading-relaxed resize-none outline-none placeholder-text-disabled"
                  rows={3}
                />
              </div>
            ))}
          </div>

          {!isKling && (
            <button onClick={addTask} className="flex items-center gap-1.5 text-[11px] text-brand hover:text-brand/80 transition-colors">
              <Plus size={12} /> 添加一条任务
            </button>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button onClick={() => setShowSaveModal(true)} className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] text-text-muted hover:text-brand hover:bg-brand/10 rounded-md transition-all border border-border-subtle hover:border-brand/30">
              <Zap size={11} /> 保存为技能
            </button>
            <div className="flex-1" />
            <button onClick={onEdit} className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all">
              重新描述
            </button>
            <button
              onClick={onConfirm}
              disabled={!canAfford || hasEmptyPrompts}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all hover:-translate-y-0.5 disabled:hover:translate-y-0"
            >
              <CheckCircle size={14} /> 确认提交
            </button>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <SaveSkillModal
          onClose={() => setShowSaveModal(false)}
          tasks={saveTasksForSkill}
          model={sharedModel}
          duration={sharedDuration}
          aspectRatio={sharedRatio}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update ChatPanel.tsx — replace inline BatchConfirmCard**

Add import:
```typescript
import { BatchConfirmCard } from './confirm/BatchConfirmCard';
```

Delete the inline `function BatchConfirmCard(...)` definition (lines 106–408 approximately — it includes `BatchTaskPromptCard`).

Also delete the `function BatchTaskPromptCard(...)` helper that's only used by BatchConfirmCard (lines 41–104).

In `MessageBubble`, the `<BatchConfirmCard ...>` usage passes `onSaveAsSkill` and `onUpdateSkill` props which no longer exist. Remove those two props from the call site.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

- [ ] **Step 4: Restart and test**

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; lsof -ti:5174 | xargs kill -9 2>/dev/null; pkill -f "electron" 2>/dev/null; npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 8
```

Verify: batch task → confirm card shows with clickable pills + "保存为技能" button.

- [ ] **Step 5: Commit**

```bash
git add src/components/confirm/BatchConfirmCard.tsx src/components/ChatPanel.tsx
git commit -m "feat: extract BatchConfirmCard with clickable param pills and SaveSkillModal"
```

---

## Task 6: Extract KlingConfirmCard

**Files:**
- Create: `src/components/confirm/KlingConfirmCard.tsx`
- Modify: `src/components/ChatPanel.tsx`

New KlingConfirmCard: make prompt editable (was a `<p>` tag), add clickable pills for duration + ratio, add SaveSkillModal.

- [ ] **Step 1: Create KlingConfirmCard.tsx**

```tsx
// src/components/confirm/KlingConfirmCard.tsx
import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useStore } from '../../store';
import { localFileUrlSync } from '../../utils/localFile';
import { SaveSkillModal } from './SaveSkillModal';

function cyclePill<T>(current: T, options: T[]): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

const RATIO_OPTIONS = ['9:16', '16:9', '1:1'];
const DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

interface KlingData {
  prompt: string;
  imagePaths: string[];
  duration: number;
  aspectRatio: string;
  cost: number;
}

export function KlingConfirmCard({ data, onConfirm, onCancel }: {
  data: KlingData;
  onConfirm: (updated: { prompt: string; duration: number; aspectRatio: string }) => void;
  onCancel: () => void;
}) {
  const { credits } = useStore();
  const [prompt, setPrompt] = useState(data.prompt);
  const [duration, setDuration] = useState(data.duration);
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const cost = duration * 10;
  const canAfford = credits.balance >= cost;

  return (
    <>
      <div className="bg-surface-2 border border-border-subtle rounded-xl overflow-hidden max-w-[85%] animate-fade-in-up">
        <div className="h-px bg-brand" />
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-brand flex items-center gap-1.5">
              <Zap size={11} /> 可灵 O1 · 图生视频
            </span>
          </div>

          {/* Clickable pills */}
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-surface-3 rounded text-[10px] text-text-secondary font-mono">Kling O1</span>
            <button onClick={() => setDuration(cyclePill(duration, DURATION_OPTIONS))} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换时长">
              {duration}s
            </button>
            <button onClick={() => setAspectRatio(cyclePill(aspectRatio, RATIO_OPTIONS))} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换比例">
              {aspectRatio}
            </button>
          </div>

          {/* Image thumbnails */}
          <div className="flex gap-1.5 flex-wrap">
            {data.imagePaths.slice(0, 7).map((p, i) => (
              <div key={i} className="w-12 h-12 rounded-md overflow-hidden bg-surface-3 shrink-0 border border-border-subtle">
                <img src={localFileUrlSync(p)} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>

          {/* Editable prompt */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="输入提示词（可选）..."
            className="w-full bg-surface-3 border border-border-subtle rounded-lg px-2.5 py-2 text-xs text-text-primary leading-relaxed resize-none outline-none focus:border-brand transition-colors"
            rows={3}
          />

          {/* Credit cost */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
            <div className="flex items-center gap-1.5">
              <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
              <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>消耗 {cost} 积分</span>
            </div>
            <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
              余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-2 bg-surface-3 hover:bg-brand/10 text-text-muted hover:text-brand text-xs rounded-lg transition-colors border border-border-subtle hover:border-brand/30"
            >
              <Zap size={11} className="inline mr-1" />保存为技能
            </button>
            <div className="flex-1" />
            <button onClick={onCancel} className="px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs rounded-lg transition-colors">
              取消
            </button>
            <button
              onClick={() => onConfirm({ prompt, duration, aspectRatio })}
              disabled={!canAfford}
              className="flex-1 py-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium rounded-lg transition-all"
            >
              确认生成
            </button>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <SaveSkillModal
          onClose={() => setShowSaveModal(false)}
          tasks={[{ prompt }]}
          model="kling-o1"
          duration={duration}
          aspectRatio={aspectRatio}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update ChatPanel.tsx — replace inline KlingConfirmCard**

Add import:
```typescript
import { KlingConfirmCard } from './confirm/KlingConfirmCard';
```

Delete the inline `function KlingConfirmCard(...)` definition (lines 4013–4087 approximately).

In `MessageBubble`, the call site for KlingConfirmCard (around line 4329) currently reads:
```tsx
<KlingConfirmCard
  data={data}
  onConfirm={() => onConfirmKling?.(data)}
  onCancel={() => {}}
  onSaveAsSkill={onSaveAsSkill ? () => onSaveAsSkill() : undefined}
/>
```

The new card's `onConfirm` receives `(updated: { prompt, duration, aspectRatio })`. Update the call site:
```tsx
<KlingConfirmCard
  data={data}
  onConfirm={(updated) => onConfirmKling?.({ ...data, ...updated })}
  onCancel={() => {}}
/>
```

The `onSaveAsSkill` prop is gone (handled internally). Also remove it from `MessageBubble`'s prop types if it's only used for Kling and Batch (check if ConfirmCard usage in Task 4 already cleaned this up; if `onSaveAsSkill` is still passed anywhere to MessageBubble, leave the type but stop threading it).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

- [ ] **Step 4: Restart and test**

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; lsof -ti:5174 | xargs kill -9 2>/dev/null; pkill -f "electron" 2>/dev/null; npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 8
```

Verify: Kling O1 mode → direct send → confirm card shows editable prompt textarea + clickable duration/ratio pills + "保存为技能" button.

- [ ] **Step 5: Commit**

```bash
git add src/components/confirm/KlingConfirmCard.tsx src/components/ChatPanel.tsx
git commit -m "feat: extract KlingConfirmCard with editable prompt, clickable pills, and SaveSkillModal"
```

---

## Task 7: SkillEditor improvements

**Files:**
- Modify: `src/components/SkillsPanel.tsx`

Two improvements in the existing SkillEditor component:
1. Auto-expanding textareas (3–10 rows, resizes as content grows)
2. Material slot file previews: show image thumbnails and video frames instead of just filenames

- [ ] **Step 1: Add imports to SkillsPanel.tsx**

At the top of `src/components/SkillsPanel.tsx`, add:
```typescript
import { localFileUrlSync } from '../utils/localFile';
import { VideoThumb } from './confirm/VideoThumb';
```

Also add `setPreviewUrl` to the useStore destructure in SkillEditor if not already present. SkillEditor is a local function component; it calls `window.api.selectFiles()` already, so it can also read from the store.

Add this inside `SkillEditor` (after the existing state declarations):
```typescript
const setPreviewUrl = useStore(s => s.setPreviewUrl);
```

- [ ] **Step 2: Replace fixed-row textareas with auto-expanding ones**

Find the textarea inside the tasks map in SkillEditor (around line 210):
```tsx
<textarea
  value={task.prompt}
  onChange={e => updateTaskPrompt(i, e.target.value)}
  placeholder={`提示词 #${i + 1}...`}
  rows={2}
  className="flex-1 bg-surface-2 border border-border rounded-md px-2.5 py-2 text-xs text-text-primary resize-none outline-none focus:border-brand transition-colors"
/>
```

Replace with:
```tsx
<textarea
  value={task.prompt}
  onChange={e => updateTaskPrompt(i, e.target.value)}
  onInput={(e) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = Math.min(200, Math.max(60, el.scrollHeight)) + 'px';
  }}
  placeholder={`提示词 #${i + 1}...`}
  className="flex-1 bg-surface-2 border border-border rounded-md px-2.5 py-2 text-xs text-text-primary resize-none outline-none focus:border-brand transition-colors"
  style={{ minHeight: '3.75rem', maxHeight: '12.5rem' }}
/>
```

- [ ] **Step 3: Add thumbnail previews to material slots**

Find the slot rendering section in SkillEditor (around line 168). The current slot row reads:
```tsx
<div key={i} className="flex items-center gap-2 bg-surface-2 rounded-md px-2.5 py-1.5">
  <span className="text-sm">{slotTypeIcon(slot.type)}</span>
  <span className="text-[11px] text-text-secondary w-8 shrink-0">{slotTypeLabel(slot.type)}</span>
  <button onClick={() => pickSlotFile(i)}
    className="flex-1 text-left text-[11px] text-text-muted hover:text-brand transition-colors truncate">
    {slot.path ? slot.path.split('/').pop() : '点击选择文件（可选）'}
  </button>
  {slot.path && (
    <button onClick={() => setSlots(prev => { const n = [...prev]; n[i] = { ...n[i], path: undefined }; return n; })}
      className="text-text-disabled hover:text-error transition-colors text-[10px]">清除</button>
  )}
  <button onClick={() => removeSlot(i)}
    className="text-text-disabled hover:text-error transition-colors shrink-0">
    <Trash2 size={11} />
  </button>
</div>
```

Replace with:
```tsx
<div key={i} className="flex items-center gap-2 bg-surface-2 rounded-md px-2.5 py-1.5">
  {/* Thumbnail preview when file is set */}
  {slot.path ? (
    <button
      onClick={() => setPreviewUrl(localFileUrlSync(slot.path!))}
      className="w-12 h-12 rounded-md overflow-hidden border border-border hover:border-brand flex-shrink-0 transition-all"
      title="点击预览"
    >
      {slot.type === 'image' ? (
        <img src={localFileUrlSync(slot.path)} alt="" className="w-full h-full object-cover" />
      ) : slot.type === 'video' ? (
        <VideoThumb path={slot.path} size={24} />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-purple-500/20">
          <span className="text-purple-400">♪</span>
        </div>
      )}
    </button>
  ) : (
    <span className="text-sm flex-shrink-0">{slotTypeIcon(slot.type)}</span>
  )}
  <span className="text-[11px] text-text-secondary w-8 shrink-0">{slotTypeLabel(slot.type)}</span>
  <button onClick={() => pickSlotFile(i)}
    className="flex-1 text-left text-[11px] text-text-muted hover:text-brand transition-colors truncate">
    {slot.path ? slot.path.split('/').pop() : '点击选择文件（可选）'}
  </button>
  {slot.path && (
    <button onClick={() => setSlots(prev => { const n = [...prev]; n[i] = { ...n[i], path: undefined }; return n; })}
      className="text-text-disabled hover:text-error transition-colors text-[10px]">清除</button>
  )}
  <button onClick={() => removeSlot(i)}
    className="text-text-disabled hover:text-error transition-colors shrink-0">
    <Trash2 size={11} />
  </button>
</div>
```

Note: `VideoModal` in this app shows both images and videos (it detects by extension). So calling `setPreviewUrl(localFileUrlSync(imagePath))` will display an image preview correctly in the modal. This is documented in CLAUDE.md under "BatchDrawer 素材预览 + 任务行播放提示".

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -30
```

- [ ] **Step 5: Restart and test**

```bash
lsof -ti:5173 | xargs kill -9 2>/dev/null; lsof -ti:5174 | xargs kill -9 2>/dev/null; pkill -f "electron" 2>/dev/null; npm run electron:dev > /tmp/electron-dev.log 2>&1 &
sleep 8
```

Verify:
1. Open SkillEditor (new skill or edit existing) → textarea grows as you type past 3 lines
2. Add a material slot → select an image or video file → thumbnail appears in the slot row
3. Click the thumbnail → VideoModal preview opens

- [ ] **Step 6: Update CLAUDE.md**

Add a section documenting the Skills UX redesign.

- [ ] **Step 7: Commit**

```bash
git add src/components/SkillsPanel.tsx CLAUDE.md
git commit -m "feat: SkillEditor auto-expanding textareas and material slot thumbnail previews"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 4 confirm cards extracted to `src/components/confirm/` | Tasks 3–6 |
| Params pills (clickable cycling) | Tasks 3–6 |
| Prompt editable in all cards | Tasks 3–6 (SkillConfirmCard + ConfirmCard + KlingConfirmCard) |
| 保存为技能 button on all 4 cards → SaveSkillModal | Tasks 1, 3–6 |
| SaveSkillModal: new skill / update existing skill | Task 1 |
| SkillConfirmCard opened from SkillsPanel defaults to update mode | Task 1 + 3 |
| pendingSkillConfirm store field | Task 2 |
| SkillsPanel 使用 → immediate skill-confirm card (no user send) | Task 2 |
| handleSkillSend deleted | Task 2 |
| handleApplySkill in chat now also shows confirm card directly | Task 2 |
| SkillEditor auto-expanding textarea (3–10 rows) | Task 7 |
| SkillEditor material slot thumbnail preview | Task 7 |
| Click image/video slot → VideoModal | Task 7 |

**Placeholder scan:** No TBDs or TODOs in any task.

**Type consistency check:**
- `SkillTask` imported from `../../store` in all confirm card files
- `cyclePill<T>` function defined in each card file (small enough to not warrant a shared file)
- `VideoThumb` exported from `./confirm/VideoThumb` and imported in each card that uses it
- `SaveSkillModal` exported from `./confirm/SaveSkillModal` and imported in each card
- `KlingConfirmCard.onConfirm` signature changed from `() => void` to `(updated: { prompt: string; duration: number; aspectRatio: string }) => void` — call site in MessageBubble updated in Task 6 Step 2
