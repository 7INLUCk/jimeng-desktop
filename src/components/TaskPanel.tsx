import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ListTodo, Clock, Loader2, CheckCircle, XCircle,
  Download, Play, Trash2, RefreshCw, Film, Image as ImageIcon,
  ArrowRight, FolderOpen, StopCircle
} from 'lucide-react';
import { useStore, type TaskRecord, type TaskFilter } from '../store';

// ── Status Colors ──
const statusColor: Record<string, string> = {
  pending: 'var(--color-text-secondary)',
  uploading: 'var(--color-brand)',
  queued: 'oklch(0.75 0.16 75)',
  generating: 'var(--color-brand)',
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
      className="transition-all duration-150"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        cursor: draggable ? 'grab' : 'default',
        opacity: draggable ? 1 : 0.95,
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '14px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-1">
            {draggable && <span style={{ color: 'var(--color-text-disabled)', cursor: 'grab' }}>⠿</span>}
            <span style={{ fontSize: '12px' }}>
              {isGenerating ? '🔄' : isQueued ? '⏳' : '📤'}
            </span>
            <span
              className="truncate"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}
              title={task.prompt}
            >
              {task.prompt.slice(0, 40)}{task.prompt.length > 40 ? '…' : ''}
            </span>
          </div>

          {/* Model & status */}
          <p
            className="mb-2"
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted)',
            }}
          >
            {task.model} · {statusLabel[task.status]}
            {isQueued && task.queuePosition != null && ` · 队列 #${task.queuePosition}`}
          </p>

          {/* Progress bar (only for generating) */}
          {isGenerating && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <div
                  className="flex-1 overflow-hidden mr-3"
                  style={{
                    height: '6px',
                    background: 'var(--color-surface-3)',
                    borderRadius: 'var(--radius-lg)',
                  }}
                >
                  <div
                    className="h-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progress}%`,
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: statusColor.generating,
                    }}
                  />
                </div>
                <span
                  className="shrink-0 font-mono"
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {progress}%
                </span>
              </div>
              {task.estimatedMinutes != null && (
                <p style={{ fontSize: '10px', color: 'var(--color-text-disabled)' }}>
                  预计剩余: {task.estimatedMinutes} 分钟
                </p>
              )}
            </div>
          )}

          {/* Queue estimation */}
          {isQueued && task.queuePosition != null && task.queuePosition > 5000 && (
            <p style={{ fontSize: '10px', color: 'var(--color-text-disabled)' }}>
              预计等待: 约 {Math.ceil(task.queuePosition / 100)} 分钟
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1.5 mt-1">
        <button
          onClick={() => updateTask(task.id, { status: 'failed', error: '用户取消', completedAt: Date.now() })}
          className="transition-all duration-150"
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'oklch(0.6 0.2 25)';
            e.currentTarget.style.background = 'oklch(0.6 0.2 25 / 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
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
      className="group overflow-hidden transition-all duration-200"
      style={{
        background: 'var(--color-surface-2)',
        borderRadius: 'var(--radius-md)',
        border: highlighted
          ? '1px solid var(--color-brand)'
          : '1px solid var(--color-border-subtle)',
        boxShadow: highlighted ? 'var(--shadow-brand)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!highlighted) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-card)';
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }
      }}
      onMouseLeave={(e) => {
        if (!highlighted) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'transparent';
          e.currentTarget.style.borderColor = 'var(--color-border-subtle)';
        }
      }}
    >
      {/* Thumbnail area */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{ background: 'var(--color-surface-3)' }}
      >
        {task.thumbnailUrl ? (
          <img
            src={task.thumbnailUrl}
            alt={task.prompt.slice(0, 20)}
            className="w-full h-full object-cover transition-transform duration-300"
            loading="lazy"
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film size={24} style={{ color: 'var(--color-text-disabled)' }} />
          </div>
        )}

        {/* Duration badge */}
        <div
          className="absolute top-1.5 left-1.5 flex items-center"
          style={{
            padding: '2px 6px',
            background: 'rgb(0 0 0 / 0.7)',
            backdropFilter: 'blur(4px)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '10px',
            color: 'rgb(255 255 255 / 0.9)',
            fontFamily: 'monospace',
          }}
        >
          {task.duration}s
        </div>

        {/* Action overlay */}
        <div
          className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200"
        >
          {task.resultUrl && (
            <button
              onClick={() => useStore.getState().setPreviewUrl(task.resultUrl!)}
              className="transition-colors"
              style={{
                padding: '6px',
                background: 'rgb(0 0 0 / 0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: 'var(--radius-md)',
                color: 'white',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-brand)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgb(0 0 0 / 0.6)'}
              title="预览"
            >
              <Play size={13} />
            </button>
          )}
          {task.resultUrl && (
            <button
              onClick={handleDownload}
              className="transition-colors"
              style={{
                padding: '6px',
                background: 'rgb(0 0 0 / 0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: 'var(--radius-md)',
                color: 'white',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-brand)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgb(0 0 0 / 0.6)'}
              title="下载"
            >
              <Download size={13} />
            </button>
          )}
          {task.localPath && (
            <button
              onClick={() => window.api.openFile(task.localPath!)}
              className="transition-colors"
              style={{
                padding: '6px',
                background: 'rgb(0 0 0 / 0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: 'var(--radius-md)',
                color: 'white',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-brand)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgb(0 0 0 / 0.6)'}
              title="打开文件"
            >
              <FolderOpen size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2">
        <p
          className="line-clamp-2 leading-relaxed"
          style={{
            fontSize: '11px',
            color: 'var(--color-text-primary)',
          }}
          title={task.prompt}
        >
          {task.prompt || '无提示词'}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p
            className="font-mono"
            style={{
              fontSize: '10px',
              color: 'var(--color-text-disabled)',
            }}
          >
            {new Date(task.completedAt || task.createdAt).toLocaleString('zh-CN', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 500,
              color: task.status === 'downloaded' ? statusColor.downloaded : statusColor.completed,
            }}
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
    <div
      className="transition-all duration-150"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '14px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: '12px' }}>🎬</span>
            <span
              className="truncate"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}
              title={task.prompt}
            >
              {task.prompt.slice(0, 40)}{task.prompt.length > 40 ? '…' : ''}
            </span>
          </div>
          <p
            className="mt-1"
            style={{
              fontSize: '11px',
              color: statusColor.failed,
            }}
          >
            ❌ {task.error || '未知错误'}
          </p>
          <p
            className="mt-1 font-mono"
            style={{
              fontSize: '10px',
              color: 'var(--color-text-disabled)',
            }}
          >
            {new Date(task.createdAt).toLocaleString('zh-CN')} · 重试 {task.retryCount} 次
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-2">
        <button
          onClick={() => retryTask(task.id)}
          className="flex items-center gap-1 transition-all duration-150"
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--color-brand)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-brand-subtle)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <RefreshCw size={12} /> 重试
        </button>
        <button
          onClick={() => removeTask(task.id)}
          className="flex items-center gap-1 transition-all duration-150"
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-md)',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'oklch(0.6 0.2 25)';
            e.currentTarget.style.background = 'oklch(0.6 0.2 25 / 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-muted)';
            e.currentTarget.style.background = 'transparent';
          }}
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
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--color-border-subtle)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <ListTodo size={16} style={{ color: 'var(--color-brand)' }} />
          <h1
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >任务管理</h1>
        </div>

        {/* Filter tabs */}
        <div
          className="flex items-center gap-0.5"
          style={{
            background: 'var(--color-surface-2)',
            borderRadius: 'var(--radius-md)',
            padding: '2px',
          }}
        >
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
                className="flex items-center gap-1 transition-all duration-150"
                style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: isActive
                    ? 'white'
                    : 'var(--color-text-muted)',
                  background: isActive
                    ? 'var(--color-brand)'
                    : 'transparent',
                  boxShadow: isActive ? '0 1px 2px rgb(0 0 0 / 0.05)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-text-muted)';
                  }
                }}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className="flex items-center justify-center"
                    style={{
                      minWidth: '16px',
                      height: '16px',
                      padding: '0 4px',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '10px',
                      background: isActive
                        ? 'rgb(255 255 255 / 0.2)'
                        : 'var(--color-surface-3)',
                    }}
                  >
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
            <div
              className="flex items-center justify-center mb-4"
              style={{
                width: '64px',
                height: '64px',
                background: 'var(--color-surface-2)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <ListTodo size={28} style={{ color: 'var(--color-text-disabled)' }} />
            </div>
            <p
              className="mb-1"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
              }}
            >还没有任务</p>
            <p
              className="mb-4"
              style={{
                fontSize: '12px',
                color: 'var(--color-text-muted)',
              }}
            >去对话框创建一个吧</p>
            <button
              onClick={() => useStore.getState().setActivePanel('chat')}
              className="flex items-center gap-1.5 transition-all duration-150"
              style={{
                padding: '6px 12px',
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-3)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-2)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
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
                <h3
                  className="mb-2.5 flex items-center gap-1.5"
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <Loader2 size={12} className="animate-spin" style={{ color: statusColor.generating }} />
                  生成中
                  <span
                    className="ml-1"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-surface-3)',
                      fontSize: '10px',
                    }}
                  >
                    {generatingTasks.length}
                  </span>
                  {generatingTasks.length > 0 && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-disabled)' }}>
                      · 预计还需 ~{generatingTasks.length * 3} 分钟
                    </span>
                  )}
                  <button
                    onClick={() => generatingTasks.forEach(t => updateTask(t.id, { status: 'failed', error: '用户取消', completedAt: Date.now() }))}
                    className="ml-auto flex items-center gap-1 transition-all duration-150"
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '10px',
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'oklch(0.6 0.2 25)';
                      e.currentTarget.style.background = 'oklch(0.6 0.2 25 / 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }}
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
                <h3
                  className="mb-2.5 flex items-center gap-1.5"
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <Clock size={12} style={{ color: statusColor.queued }} />
                  排队中
                  <span
                    className="ml-1"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-surface-3)',
                      fontSize: '10px',
                    }}
                  >
                    {queuedTasks.length}
                  </span>
                  {queuedTasks.length > 0 && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-disabled)' }}>
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
                <h3
                  className="mb-2.5 flex items-center gap-1.5"
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <CheckCircle size={12} style={{ color: statusColor.completed }} />
                  已完成
                  <span
                    className="ml-1"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-surface-3)',
                      fontSize: '10px',
                    }}
                  >
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
                    className="ml-auto flex items-center gap-1 transition-all duration-150"
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '10px',
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-brand)';
                      e.currentTarget.style.background = 'var(--color-brand-subtle)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-text-muted)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Download size={11} />
                    全部下载
                  </button>
                </h3>
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  }}
                >
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
                <h3
                  className="mb-2.5 flex items-center gap-1.5"
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <XCircle size={12} style={{ color: statusColor.failed }} />
                  失败
                  <span
                    className="ml-1"
                    style={{
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--color-surface-3)',
                      fontSize: '10px',
                    }}
                  >
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
