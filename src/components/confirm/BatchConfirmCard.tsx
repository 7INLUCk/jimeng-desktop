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
  reason: string;
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
    setBatchTasks([...batchTasks, newTask as any]);
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
