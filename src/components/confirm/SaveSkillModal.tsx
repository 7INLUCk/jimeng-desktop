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
      const newSkill: Skill = {
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
      };
      addSkill(newSkill);
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
