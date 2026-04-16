import { useState } from 'react';
import { Zap, Plus, Trash2, Copy, Edit3, ChevronDown, ChevronUp, Clock, RotateCcw, MessageSquare, Layers } from 'lucide-react';
import { useStore, type Skill, type SkillTask } from '../store';
import { localFileUrlSync } from '../utils/localFile';
import { VideoThumb } from './confirm/VideoThumb';

// ── Format helpers ──
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

type MaterialSlot = { type: 'image' | 'video' | 'audio'; path?: string };

// ── Skill Editor Modal ──
function SkillEditor({
  skill,
  onSave,
  onCancel,
}: {
  skill: Partial<Skill> & { tasks: SkillTask[] };
  onSave: (skill: Partial<Skill>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(skill.name || '');
  const [description, setDescription] = useState(skill.description || '');
  const [model, setModel] = useState(skill.model || 'seedance2.0fast');
  const [duration, setDuration] = useState(skill.duration || 5);
  const [aspectRatio, setAspectRatio] = useState(skill.aspectRatio || '9:16');
  const [tasks, setTasks] = useState<SkillTask[]>(skill.tasks || [{ prompt: '' }]);
  const [expandedTasks, setExpandedTasks] = useState(false);
  const [slots, setSlots] = useState<MaterialSlot[]>(skill.materialSlots || []);
  const setPreviewUrl = useStore(s => s.setPreviewUrl);

  const MODEL_OPTIONS = [
    { value: 'seedance2.0fast', label: 'Seedance Fast' },
    { value: 'seedance2.0', label: 'Seedance 2.0' },
    { value: 'kling-o1', label: 'Kling O1' },
  ];

  // Kling only supports 5s / 10s; Seedance supports full 4–15s range
  const DURATION_OPTIONS = model === 'kling-o1' ? [5, 10] : [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

  const updateTaskPrompt = (i: number, prompt: string) => {
    const next = [...tasks];
    next[i] = { ...next[i], prompt };
    setTasks(next);
  };

  const addTask = () => {
    // Kling O1 only supports single tasks
    if (model === 'kling-o1') return;
    setTasks([...tasks, { prompt: '' }]);
  };
  const removeTask = (i: number) => setTasks(tasks.filter((_, idx) => idx !== i));

  const addSlot = (type: MaterialSlot['type']) => setSlots(prev => [...prev, { type }]);
  const removeSlot = (i: number) => setSlots(prev => prev.filter((_, idx) => idx !== i));

  async function pickSlotFile(index: number) {
    const { files } = await window.api.selectFiles();
    if (!files?.length) return;
    setSlots(prev => { const next = [...prev]; next[index] = { ...next[index], path: files[0] }; return next; });
  }

  const slotTypeLabel = (t: MaterialSlot['type']) => t === 'image' ? '图片' : t === 'video' ? '视频' : '音频';
  const slotTypeIcon  = (t: MaterialSlot['type']) => t === 'image' ? '🖼️' : t === 'video' ? '🎬' : '🎵';

  // When switching to Kling, clamp to 1 task and valid duration
  function handleModelChange(m: string) {
    setModel(m);
    if (m === 'kling-o1') {
      if (tasks.length > 1) setTasks([tasks[0]]);
      if (![5, 10].includes(duration)) setDuration(5);
    }
  }

  const isValid = name.trim() && tasks.every(t => t.prompt.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-surface-1 border border-border rounded-xl w-[520px] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-brand" />
            <h3 className="text-sm font-semibold text-text-primary">
              {skill.id ? '编辑技能' : '新建技能'}
            </h3>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors text-xs">取消</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">技能名称 *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：卡通说话系列"
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1.5">描述（可选）</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="简单描述这个技能的用途..."
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors"
            />
          </div>

          {/* Params */}
          <div>
            <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-2">默认参数</label>
            <div className="flex gap-2 flex-wrap">
              {MODEL_OPTIONS.map(m => (
                <button key={m.value} onClick={() => handleModelChange(m.value)}
                  className={`px-3 py-1.5 text-[11px] rounded-md transition-all ${model === m.value ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'}`}>
                  {m.label}
                </button>
              ))}
              <div className="w-px bg-border mx-1" />
              {DURATION_OPTIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 text-[11px] rounded-md transition-all ${duration === d ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'}`}>
                  {d}s
                </button>
              ))}
              <div className="w-px bg-border mx-1" />
              {['9:16', '16:9', '1:1', '4:3'].map(r => (
                <button key={r} onClick={() => setAspectRatio(r)}
                  className={`px-3 py-1.5 text-[11px] rounded-md transition-all ${aspectRatio === r ? 'bg-brand text-white' : 'bg-surface-2 text-text-secondary hover:bg-border'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Material Slots */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-text-muted uppercase tracking-wider">素材槽位（可选）</label>
              <div className="flex items-center gap-1">
                {(['image', 'video', 'audio'] as const).map(t => (
                  <button key={t} onClick={() => addSlot(t)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-surface-2 hover:bg-border text-text-muted hover:text-text-primary rounded transition-colors">
                    <span>{slotTypeIcon(t)}</span> {slotTypeLabel(t)}
                  </button>
                ))}
              </div>
            </div>
            {slots.length === 0 ? (
              <p className="text-[10px] text-text-disabled">无槽位 · 使用时可自由上传素材</p>
            ) : (
              <div className="space-y-1.5">
                {slots.map((slot, i) => (
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
                ))}
              </div>
            )}
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-text-muted uppercase tracking-wider">
                提示词 ({tasks.length} 条{tasks.length > 1 ? ' · 批量' : ' · 单个'})
              </label>
              {tasks.length > 3 && (
                <button onClick={() => setExpandedTasks(v => !v)}
                  className="text-[10px] text-brand flex items-center gap-0.5">
                  {expandedTasks ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  {expandedTasks ? '收起' : `展开全部 ${tasks.length} 条`}
                </button>
              )}
            </div>
            <div className="space-y-2">
              {(expandedTasks ? tasks : tasks.slice(0, 3)).map((task, i) => (
                <div key={i} className="flex gap-2">
                  <div className="flex-shrink-0 w-5 h-5 mt-1.5 rounded bg-brand/10 flex items-center justify-center">
                    <span className="text-[9px] text-brand font-mono">{i + 1}</span>
                  </div>
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
                  {tasks.length > 1 && (
                    <button onClick={() => removeTask(i)}
                      className="flex-shrink-0 w-5 h-5 mt-1.5 rounded flex items-center justify-center text-text-muted hover:text-error transition-colors">
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
              {!expandedTasks && tasks.length > 3 && (
                <p className="text-[10px] text-text-muted pl-7">...还有 {tasks.length - 3} 条（点击展开全部）</p>
              )}
            </div>
            {model !== 'kling-o1' && (
              <button onClick={addTask}
                className="mt-2 flex items-center gap-1 text-[11px] text-brand hover:text-brand/80 transition-colors">
                <Plus size={11} /> 添加一条提示词
              </button>
            )}
            {model === 'kling-o1' && (
              <p className="mt-1.5 text-[10px] text-text-disabled">Kling O1 仅支持单个任务</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-xs text-text-secondary bg-surface-2 hover:bg-border rounded-md transition-all">
            取消
          </button>
          <button
            onClick={() => isValid && onSave({ name, description, model, duration, aspectRatio, tasks, materialSlots: slots })}
            disabled={!isValid}
            className="px-4 py-2 text-xs text-white bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all"
          >
            保存技能
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skill Card ──
function SkillCard({
  skill,
  onUse,
  onEdit,
  onDuplicate,
  onDelete,
  onRevert,
}: {
  skill: Skill;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRevert?: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showTasks, setShowTasks] = useState(false);

  const typeLabel = skill.type === 'batch'
    ? `批量 · ${skill.tasks.length} 个任务`
    : '单个任务';

  return (
    <div className="bg-surface-2 border border-border-subtle rounded-lg overflow-hidden hover:border-border transition-all group">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Zap size={14} className="text-brand" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-text-primary leading-tight">{skill.name}</p>
              {skill.description && (
                <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{skill.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={onUse}
                className="px-3 py-1 text-xs font-medium bg-brand text-white rounded-md hover:bg-brand/90 transition-all hover:-translate-y-0.5"
              >
                使用
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(v => !v)}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-all"
                >
                  <span className="text-sm leading-none">···</span>
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-8 z-20 bg-surface-1 border border-border rounded-lg shadow-lg py-1 w-32 overflow-hidden">
                      <button onClick={() => { onEdit(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-2 transition-colors">
                        <Edit3 size={11} /> 编辑
                      </button>
                      <button onClick={() => { onDuplicate(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-2 transition-colors">
                        <Copy size={11} /> 复制技能
                      </button>
                      {onRevert && skill.prevVersion && (
                        <button onClick={() => { onRevert(); setShowMenu(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-2 transition-colors">
                          <RotateCcw size={11} /> 撤销更新
                        </button>
                      )}
                      <div className="my-1 border-t border-border-subtle" />
                      <button onClick={() => { onDelete(); setShowMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-error hover:bg-error/10 transition-colors">
                        <Trash2 size={11} /> 删除
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Meta tags */}
          <div className="flex items-center flex-wrap gap-1.5 mt-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${skill.type === 'batch' ? 'bg-accent/10 text-accent' : 'bg-brand/10 text-brand'}`}>
              {skill.type === 'batch' ? <><Layers size={9} className="inline mr-0.5" />批量</> : <><MessageSquare size={9} className="inline mr-0.5" />单个</>}
            </span>
            <span className="text-[10px] text-text-muted font-mono">{skill.tasks.length} 条提示词</span>
            <span className="text-text-disabled">·</span>
            <span className="text-[10px] text-text-muted font-mono">{skill.duration}s</span>
            <span className="text-text-disabled">·</span>
            <span className="text-[10px] text-text-muted font-mono">{skill.aspectRatio}</span>
            {skill.usedCount > 0 && (
              <>
                <span className="text-text-disabled">·</span>
                <span className="text-[10px] text-text-muted">用了 {skill.usedCount} 次</span>
              </>
            )}
          </div>

          {/* Time + version hint */}
          <div className="flex items-center gap-2 mt-1.5">
            <Clock size={9} className="text-text-disabled" />
            <span className="text-[10px] text-text-disabled">更新于 {timeAgo(skill.updatedAt)}</span>
            {skill.prevVersion && (
              <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">有可撤销的更新</span>
            )}
          </div>
        </div>
      </div>

      {/* Prompts preview (collapsible) */}
      <div className="border-t border-border-subtle">
        <button
          onClick={() => setShowTasks(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
        >
          <span>预览提示词</span>
          {showTasks ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
        {showTasks && (
          <div className="px-4 pb-3 space-y-1.5 max-h-48 overflow-y-auto">
            {skill.tasks.map((task, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[9px] text-brand font-mono bg-brand/10 px-1 rounded flex-shrink-0 mt-0.5 h-4 flex items-center">{i + 1}</span>
                <p className="text-[11px] text-text-secondary leading-relaxed">{task.prompt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ──
export function SkillsPanel() {
  const { skills, addSkill, updateSkill, deleteSkill, setActiveSkill, setActivePanel, setPendingSkillConfirm } = useStore();
  const [editing, setEditing] = useState<(Partial<Skill> & { tasks: SkillTask[] }) | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleCreate() {
    setEditingId(null);
    setEditing({ name: '', description: '', type: 'single', model: 'seedance2.0fast', duration: 5, aspectRatio: '9:16', tasks: [{ prompt: '' }] });
  }

  function handleEdit(skill: Skill) {
    setEditingId(skill.id);
    setEditing({ ...skill });
  }

  function handleSaveEdit(updates: Partial<Skill>) {
    if (editingId) {
      // Update existing — preserve prev version
      const existing = skills.find(s => s.id === editingId);
      if (existing) {
        updateSkill(editingId, {
          ...updates,
          type: (updates.tasks?.length ?? 1) > 1 ? 'batch' : 'single',
          updatedAt: Date.now(),
          prevVersion: {
            tasks: existing.tasks,
            model: existing.model,
            duration: existing.duration,
            aspectRatio: existing.aspectRatio,
            updatedAt: existing.updatedAt,
          },
        });
      }
    } else {
      // Create new
      const now = Date.now();
      addSkill({
        id: `skill_${now}`,
        name: updates.name || '新技能',
        description: updates.description || '',
        type: (updates.tasks?.length ?? 1) > 1 ? 'batch' : 'single',
        model: updates.model || 'seedance2.0fast',
        duration: updates.duration || 5,
        aspectRatio: updates.aspectRatio || '9:16',
        tasks: updates.tasks || [{ prompt: '' }],
        materialSlots: updates.materialSlots,
        createdAt: now,
        updatedAt: now,
        usedCount: 0,
      });
    }
    setEditing(null);
    setEditingId(null);
  }

  function handleDuplicate(skill: Skill) {
    const now = Date.now();
    addSkill({
      ...skill,
      id: `skill_${now}`,
      name: skill.name + ' (副本)',
      createdAt: now,
      updatedAt: now,
      usedCount: 0,
      prevVersion: undefined,
    });
  }

  function handleRevert(skill: Skill) {
    if (!skill.prevVersion) return;
    updateSkill(skill.id, {
      tasks: skill.prevVersion.tasks,
      model: skill.prevVersion.model,
      duration: skill.prevVersion.duration,
      aspectRatio: skill.prevVersion.aspectRatio,
      updatedAt: skill.prevVersion.updatedAt,
      prevVersion: undefined,
    });
  }

  function handleUse(skill: Skill) {
    updateSkill(skill.id, { usedCount: skill.usedCount + 1 });
    setPendingSkillConfirm(skill);
    setActivePanel('chat');
  }

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Zap size={16} className="text-brand" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary">技能库</h1>
            <p className="text-xs text-text-muted">{skills.length} 个已保存的配方</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded-md transition-all hover:-translate-y-0.5"
        >
          <Plus size={13} /> 新建技能
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {skills.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center max-w-xs mx-auto">
            <div className="w-14 h-14 rounded-xl bg-brand/10 flex items-center justify-center mb-4">
              <Zap size={24} className="text-brand" />
            </div>
            <h3 className="text-sm font-semibold text-text-primary mb-2">还没有技能</h3>
            <p className="text-xs text-text-muted mb-6 leading-relaxed">
              在确认提交时点击「保存为技能」，把经过验证的提示词和参数存起来，下次一键复用。
            </p>
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-xs font-medium rounded-md hover:bg-brand/90 transition-all"
            >
              <Plus size={13} /> 手动创建第一个
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {skills.map(skill => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onUse={() => handleUse(skill)}
                onEdit={() => handleEdit(skill)}
                onDuplicate={() => handleDuplicate(skill)}
                onDelete={() => setConfirmDeleteId(skill.id)}
                onRevert={() => handleRevert(skill)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Skill editor modal */}
      {editing && (
        <SkillEditor
          skill={editing}
          onSave={handleSaveEdit}
          onCancel={() => { setEditing(null); setEditingId(null); }}
        />
      )}

      {/* Delete confirm */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-1 border border-border rounded-xl p-6 w-72 shadow-2xl">
            <h3 className="text-sm font-semibold text-text-primary mb-2">确认删除</h3>
            <p className="text-xs text-text-muted mb-5">删除后无法恢复，确认要删除这个技能吗？</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-xs text-text-secondary bg-surface-2 hover:bg-border rounded-md transition-all">
                取消
              </button>
              <button
                onClick={() => { deleteSkill(confirmDeleteId); setConfirmDeleteId(null); }}
                className="px-4 py-2 text-xs text-white bg-error hover:bg-error/90 rounded-md transition-all"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
