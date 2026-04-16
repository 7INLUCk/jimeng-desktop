import { useState } from 'react';
import { X, CheckCircle, Plus, AlertTriangle, Play, Zap } from 'lucide-react';
import { useStore, type Skill, type SkillTask } from '../../store';
import { localFileUrlSync, getFileType } from '../../utils/localFile';
import { VideoThumb } from './VideoThumb';
import { SaveSkillModal } from './SaveSkillModal';

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
  const slots = skill.materialSlots || [];
  const isBatch = skill.type === 'batch' && skill.tasks.length > 1;

  const [model, setModel] = useState(skill.model);
  const [duration, setDuration] = useState(skill.duration);
  const [aspectRatio, setAspectRatio] = useState(skill.aspectRatio);
  const [taskPrompts, setTaskPrompts] = useState<string[]>(skill.tasks.map(t => t.prompt));

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
  const hasChanges = changedSlots.size > 0 || extraFiles.length > 0;

  function handleModelCycle() {
    const next = cyclePill(model, [...MODEL_OPTIONS]);
    setModel(next);
    if (next === 'kling-o1' && ![5, 10].includes(duration)) setDuration(5);
  }

  function handleDurationCycle() {
    setDuration(cyclePill(duration, durationOptions(model)));
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

  const currentTasksForSave: SkillTask[] = skill.tasks.map((t, i) => ({
    ...t,
    prompt: taskPrompts[i] ?? t.prompt,
  }));

  return (
    <>
      <div className="bg-surface-2 border border-border rounded-md overflow-hidden w-full max-w-[560px] animate-fade-in-up">
        <div className="h-px bg-brand" />
        <div className="p-5 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-brand font-medium flex items-center gap-1.5">
              <Zap size={12} /> 技能 · {skill.name}
            </p>
          </div>

          {/* Clickable param pills */}
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
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = Math.min(300, Math.max(100, el.scrollHeight)) + 'px';
                }}
                className="w-full bg-surface-3 border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary leading-relaxed resize-none outline-none focus:border-brand transition-colors"
                style={{ minHeight: '6rem', maxHeight: '18.75rem' }}
              />
            </div>
          ) : (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">批量任务 ({skill.tasks.length} 条)</p>
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
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
                      onInput={e => {
                        const el = e.currentTarget;
                        el.style.height = 'auto';
                        el.style.height = Math.min(200, Math.max(56, el.scrollHeight)) + 'px';
                      }}
                      className="flex-1 bg-surface-3 border border-border-subtle rounded-md px-2.5 py-2 text-xs text-text-primary resize-none outline-none focus:border-brand transition-colors"
                      style={{ minHeight: '3.5rem' }}
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
