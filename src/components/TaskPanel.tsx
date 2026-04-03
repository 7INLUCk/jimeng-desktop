import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ListTodo, Clock, Loader2, CheckCircle, XCircle,
  Download, Play, Trash2, RefreshCw, Film, Image as ImageIcon,
  ArrowRight, FolderOpen, StopCircle
} from 'lucide-react';
import { useStore, type TaskRecord, type TaskFilter } from '../store';

// ── Status Colors ──
const statusColor: Record<string, string> = {
  pending: 'oklch(0.65 0.02 260)',
  uploading: 'oklch(0.65 0.25 270)',
  queued: 'oklch(0.75 0.16 75)',
  generating: 'oklch(0.65 0.25 270)',
  completed: 'oklch(0.7 0.15 145)',
  downloaded: 'oklch(0.7 0.15 145)',
  failed: 'oklch(0.6 0.2 25)',
};

const statusLabel: Record<string, string> = {
  pending: '等待中',
  uploading: '上传中',
  queued: '排队中',
  generating: '生成中',
  completed: '已完成',
  downloaded: '已下载',
  failed: '失败',
};

// ── Filter Tabs ──
const filterTabs: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' },
];

// ── Active Task Card (generating / queued / uploading / pending) ──
function ActiveTaskCard({ task, onDragStart, onDragOver, onDrop, draggable }: {
  task: TaskRecord;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  draggable?: boolean;
}) {
  const { updateTask } = useStore();

  const isGenerating = task.status === 'generating';
  const isQueued = task.status === 'queued';
  const progress = task.progress ?? 0;

  return (
    <div
      className="bg-surface-2 border border-border-subtle rounded-lg p-3.5 animate-fade-in-up transition-all duration-150"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{ cursor: draggable ? 'grab' : 'default', opacity: draggable ? 1 : 0.95 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            {draggable && <span className="text-text-disabled cursor-grab select-none">⠿</span>}
            <span className="text-xs">
              {isGenerating ? '🔄' : isQueued ? '⏳' : '📤'}
            </span>
            <span className="text-xs font-medium text-text-primary truncate" title={task.prompt}>
              {task.prompt.slice(0, 40)}{task.prompt.length > 40 ? '…' : ''}
            </span>
          </div>

          {/* Model & status */}
          <p className="text-[11px] text-text-muted mb-2">
            {task.model} · {statusLabel[task.status]}
            {isQueued && task.queuePosition != null && ` · 队列 #${task.queuePosition}`}
          </p>

          {/* Progress bar (only for generating) */}
          {isGenerating && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden mr-3">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: statusColor.generating,
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-text-secondary shrink-0">
                  {progress}%
                </span>
              </div>
              {task.estimatedMinutes != null && (
                <p className="text-[10px] text-text-disabled">
                  预计剩余: {task.estimatedMinutes} 分钟
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5 mt-1">
        <button
          onClick={() => updateTask(task.id, { status: 'failed', error: '用户取消', completedAt: Date.now() })}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          取消
        </button>
      </div>
    </div>
  );
}

// ── Completed Task Card (grid item) ──
function CompletedTaskCard({ task, highlighted }: { task: TaskRecord; highlighted: boolean }) {
  const { updateTask, removeTask } = useStore();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const handleDownload = useCallback(() => {
    if (task.resultUrl) {
      window.api.downloadTask({ url: task.resultUrl, prompt: task.prompt }).then((res: any) => {
        if (res.success) {
          updateTask(task.id, { localPath: res.filepath, status: 'downloaded' });
        }
      });
    }
  }, [task]);

  return (
    <div
      ref={cardRef}
      className={`
        group bg-surface-2 border rounded-lg overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]
        ${highlighted ? 'border-brand shadow-[var(--shadow-brand)]' : 'border-border-subtle hover:border-border'}
      `}
    >
      {/* Thumbnail area */}
      <div className="aspect-video bg-surface-3 relative overflow-hidden">
        {task.thumbnailUrl ? (
          <img
            src={task.thumbnailUrl}
            alt={task.prompt.slice(0, 20)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={24} className="text-text-disabled" />
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white/90 font-mono">
          {task.duration}s
        </div>

        {/* Action overlay */}
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          {task.resultUrl && (
            <button
              onClick={() => window.open(task.resultUrl, '_blank')}
              className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm hover:bg-brand text-white transition-colors"
              title="预览"
            >
              <Play size={13} />
            </button>
          )}
          {task.resultUrl && (
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm hover:bg-brand text-white transition-colors"
              title="下载"
            >
              <Download size={13} />
            </button>
          )}
          {task.localPath && (
            <button
              onClick={() => window.api.openFile(task.localPath!)}
              className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm hover:bg-brand text-white transition-colors"
              title="打开文件"
            >
              <FolderOpen size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-[11px] text-text-primary line-clamp-2 leading-relaxed" title={task.prompt}>
          {task.prompt || '无提示词'}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-text-disabled font-mono">
            {new Date(task.completedAt || task.createdAt).toLocaleString('zh-CN', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
          <span
            className="text-[10px] font-medium"
            style={{ color: task.status === 'downloaded' ? statusColor.downloaded : statusColor.completed }}
          >
            {task.status === 'downloaded' ? '✅ 已下载' : '✅ 完成'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Failed Task Card ──
function FailedTaskCard({ task }: { task: TaskRecord }) {
  const { retryTask, removeTask } = useStore();

  return (
    <div className="bg-surface-2 border border-border-subtle rounded-lg p-3.5 animate-fade-in-up">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs">🎬</span>
            <span className="text-xs font-medium text-text-primary truncate" title={task.prompt}>
              {task.prompt.slice(0, 40)}{task.prompt.length > 40 ? '…' : ''}
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: statusColor.failed }}>
            ❌ {task.error || '未知错误'}
          </p>
          <p className="text-[10px] text-text-disabled mt-1 font-mono">
            {new Date(task.createdAt).toLocaleString('zh-CN')} · 重试 {task.retryCount} 次
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-2">
        <button
          onClick={() => retryTask(task.id)}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-brand hover:bg-brand/10 transition-all duration-150 flex items-center gap-1"
        >
          <RefreshCw size={12} /> 重试
        </button>
        <button
          onClick={() => removeTask(task.id)}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 flex items-center gap-1"
        >
          <Trash2 size={12} /> 删除
        </button>
      </div>
    </div>
  );
}

// ── Main TaskPanel ──
export function TaskPanel() {
  const { tasks, activeTaskFilter, setFilter, highlightedTaskId, setHighlightedTaskId, updateTask } = useStore();

  // Filter tasks
  const { activeTasks, completedTasks, failedTasks } = useMemo(() => {
    const active = tasks.filter(t => ['generating', 'queued', 'pending', 'uploading'].includes(t.status));
    const completed = tasks.filter(t => ['completed', 'downloaded'].includes(t.status));
    const failed = tasks.filter(t => t.status === 'failed');
    return { activeTasks: active, completedTasks: completed, failedTasks: failed };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    switch (activeTaskFilter) {
      case 'active': return { activeTasks, completedTasks: [], failedTasks: [] };
      case 'completed': return { activeTasks: [], completedTasks, failedTasks: [] };
      case 'failed': return { activeTasks: [], completedTasks: [], failedTasks };
      default: return { activeTasks, completedTasks, failedTasks };
    }
  }, [activeTaskFilter, activeTasks, completedTasks, failedTasks]);

  const hasAnyTasks = tasks.length > 0;
  const generatingTasks = filteredTasks.activeTasks.filter(t => t.status === 'generating');
  const queuedTasks = filteredTasks.activeTasks.filter(t => ['queued', 'pending', 'uploading'].includes(t.status));

  // Drag and drop state for active tasks
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = useCallback((taskId: string) => (e: React.DragEvent) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((targetTaskId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId) return;
    // Reorder tasks: move dragged task before target task
    const taskIds = tasks.map(t => t.id);
    const dragIdx = taskIds.indexOf(draggedTaskId);
    const targetIdx = taskIds.indexOf(targetTaskId);
    if (dragIdx === -1 || targetIdx === -1) return;
    const newTasks = [...tasks];
    const [moved] = newTasks.splice(dragIdx, 1);
    newTasks.splice(targetIdx, 0, moved);
    // Update store with reordered tasks
    useStore.setState({ tasks: newTasks });
    try { localStorage.setItem('vidclaw_tasks', JSON.stringify(newTasks)); } catch {}
    setDraggedTaskId(null);
  }, [draggedTaskId, tasks]);

  // Clear highlight after delay
  useEffect(() => {
    if (highlightedTaskId) {
      const timer = setTimeout(() => setHighlightedTaskId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedTaskId, setHighlightedTaskId]);

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <ListTodo size={16} className="text-brand" />
          <h1 className="text-sm font-semibold text-text-primary">任务管理</h1>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center bg-surface-2 rounded-lg p-0.5 gap-0.5">
          {filterTabs.map(tab => {
            const isActive = activeTaskFilter === tab.key;
            // Count per tab
            const count = tab.key === 'all' ? tasks.length
              : tab.key === 'active' ? activeTasks.length
              : tab.key === 'completed' ? completedTasks.length
              : failedTasks.length;
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`
                  px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150 flex items-center gap-1
                  ${isActive
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                  }
                `}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`
                    min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center
                    ${isActive ? 'bg-white/20' : 'bg-surface-3'}
                  `}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!hasAnyTasks ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <ListTodo size={28} className="text-text-disabled" />
            </div>
            <p className="text-sm font-medium text-text-secondary mb-1">还没有任务</p>
            <p className="text-xs text-text-muted mb-4">去对话框创建一个吧</p>
            <button
              onClick={() => useStore.getState().setActivePanel('chat')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-text-secondary hover:text-text-primary transition-all duration-150 border border-border-subtle"
            >
              <ArrowRight size={14} />
              前往对话
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* 🔄 Generating group */}
            {generatingTasks.length > 0 && (
              <section>
                <h3 className="text-[11px] font-medium text-text-muted mb-2.5 flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" style={{ color: statusColor.generating }} />
                  生成中
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-3 text-[10px]">
                    {generatingTasks.length}
                  </span>
                  {generatingTasks.length > 0 && (
                    <span className="text-[10px] text-text-disabled">
                      · 预计还需 ~{generatingTasks.length * 3} 分钟
                    </span>
                  )}
                  <button
                    onClick={() => generatingTasks.forEach(t => updateTask(t.id, { status: 'failed', error: '用户取消', completedAt: Date.now() }))}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
                  >
                    <StopCircle size={11} />
                    全部取消
                  </button>
                </h3>
                <div className="space-y-2">
                  {generatingTasks.map(task => (
                    <ActiveTaskCard
                      key={task.id}
                      task={task}
                      draggable
                      onDragStart={handleDragStart(task.id)}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop(task.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ⏳ Queued group */}
            {queuedTasks.length > 0 && (
              <section>
                <h3 className="text-[11px] font-medium text-text-muted mb-2.5 flex items-center gap-1.5">
                  <Clock size={12} style={{ color: statusColor.queued }} />
                  排队中
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-3 text-[10px]">
                    {queuedTasks.length}
                  </span>
                  {queuedTasks.length > 0 && (
                    <span className="text-[10px] text-text-disabled">
                      · 预计还需 ~{(generatingTasks.length + queuedTasks.length) * 3} 分钟
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  {queuedTasks.map(task => (
                    <ActiveTaskCard
                      key={task.id}
                      task={task}
                      draggable
                      onDragStart={handleDragStart(task.id)}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop(task.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ✅ Completed group */}
            {filteredTasks.completedTasks.length > 0 && (
              <section>
                <h3 className="text-[11px] font-medium text-text-muted mb-2.5 flex items-center gap-1.5">
                  <CheckCircle size={12} style={{ color: statusColor.completed }} />
                  已完成
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-3 text-[10px]">
                    {filteredTasks.completedTasks.length}
                  </span>
                  <button
                    onClick={() => filteredTasks.completedTasks.forEach(task => {
                      if (task.resultUrl) {
                        window.api.downloadTask({ url: task.resultUrl, prompt: task.prompt }).then((res: any) => {
                          if (res.success) updateTask(task.id, { localPath: res.filepath, status: 'downloaded' });
                        });
                      }
                    })}
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-text-muted hover:text-brand hover:bg-brand/10 transition-all duration-150"
                  >
                    <Download size={11} />
                    全部下载
                  </button>
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 stagger-children">
                  {filteredTasks.completedTasks.map(task => (
                    <CompletedTaskCard
                      key={task.id}
                      task={task}
                      highlighted={highlightedTaskId === task.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ❌ Failed group */}
            {filteredTasks.failedTasks.length > 0 && (
              <section>
                <h3 className="text-[11px] font-medium text-text-muted mb-2.5 flex items-center gap-1.5">
                  <XCircle size={12} style={{ color: statusColor.failed }} />
                  失败
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-surface-3 text-[10px]">
                    {filteredTasks.failedTasks.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {filteredTasks.failedTasks.map(task => (
                    <FailedTaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
