import { useMemo, useState, useEffect } from 'react';
import { Loader2, Clock, Film, Image as ImageIcon, CheckCircle, XCircle, AlertTriangle, Trash2, RefreshCw, Download, Play } from 'lucide-react';
import { useStore, type TaskRecord } from '../store';


const statusColor: Record<string, string> = {
  pending: 'text-text-muted',
  queued: 'text-warning',
  generating: 'text-brand',
  uploading: 'text-brand',
  completed: 'text-success',
  downloaded: 'text-success',
  failed: 'text-error',
};

const statusLabel: Record<string, string> = {
  pending: '等待中',
  queued: '排队中',
  generating: '生成中',
  uploading: '上传中',
  completed: '已完成',
  downloaded: '已下载',
  failed: '失败',
};

type FilterType = 'active' | 'completed' | 'failed' | 'all';

export function QueuePanel() {
  const { tasks } = useStore();
  const [filter, setFilter] = useState<FilterType>('active');

  // 分类任务
  const categorizedTasks = useMemo(() => {
    const active = tasks.filter(t => ['pending', 'queued', 'generating', 'uploading'].includes(t.status));
    const completed = tasks.filter(t => ['completed', 'downloaded'].includes(t.status));
    const failed = tasks.filter(t => t.status === 'failed');
    return { active, completed, failed, all: tasks };
  }, [tasks]);

  const filteredTasks = categorizedTasks[filter];
  const activeCount = categorizedTasks.active.length;
  const completedCount = categorizedTasks.completed.length;
  const failedCount = categorizedTasks.failed.length;

  // Tab 配置
  const tabs: { key: FilterType; label: string; count: number; icon?: React.ReactNode }[] = [
    { key: 'active', label: '进行中', count: activeCount, icon: activeCount > 0 ? <Loader2 size={12} className="animate-spin" /> : undefined },
    { key: 'completed', label: '已完成', count: completedCount, icon: completedCount > 0 ? <CheckCircle size={12} /> : undefined },
    { key: 'failed', label: '失败', count: failedCount, icon: failedCount > 0 ? <XCircle size={12} /> : undefined },
    { key: 'all', label: '全部', count: tasks.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab 切换 */}
      <div className="px-3 pt-3 pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-1.5">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-brand text-white'
                  : 'bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`px-1 py-0.5 rounded text-[10px] ${
                  filter === tab.key ? 'bg-white/20' : 'bg-surface-2'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filteredTasks.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterType }) {
  const messages: Record<FilterType, { title: string; subtitle: string; icon: React.ReactNode }> = {
    active: { title: '队列为空', subtitle: '新任务会在这里显示', icon: <Loader2 size={20} className="text-text-muted" /> },
    completed: { title: '暂无已完成任务', subtitle: '完成的任务会在这里展示', icon: <CheckCircle size={20} className="text-success/40" /> },
    failed: { title: '暂无失败任务', subtitle: '失败的任务会在这里记录', icon: <XCircle size={20} className="text-error/40" /> },
    all: { title: '暂无任务', subtitle: '开始创作吧', icon: <Film size={20} className="text-text-muted" /> },
  };
  const msg = messages[filter];

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-md bg-surface-2 flex items-center justify-center mx-auto mb-3">
          {msg.icon}
        </div>
        <p className="text-text-primary text-sm font-medium">{msg.title}</p>
        <p className="text-text-muted text-xs mt-1">{msg.subtitle}</p>
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskRecord }) {
  const { retryTask, deleteTask, downloadTask } = useStore();
  const isKling     = task.model === 'kling-o1';
  const isQueued    = task.status === 'queued';
  const isGenerating = task.status === 'generating';
  const isCompleted = ['completed', 'downloaded'].includes(task.status);
  const isFailed    = task.status === 'failed';

  // ── Countdown (Seedance queued) ──────────────────────────────────────────
  // Re-render every minute so the minsLeft computation stays accurate.
  const [, forceMinuteUpdate] = useState(0);
  useEffect(() => {
    if (!isQueued) return;
    const id = setInterval(() => forceMinuteUpdate(n => n + 1), 60_000);
    return () => clearInterval(id);
  }, [isQueued]);

  const minsLeft = (isQueued && task.nextPollAt)
    ? Math.max(0, Math.ceil((task.nextPollAt - Date.now()) / 60_000))
    : null;

  // ── Crawl progress (Kling generating phase 30→90%) ──────────────────────
  // Slowly inches forward while the SSE stream runs to give the bar life.
  const [crawlPct, setCrawlPct] = useState<number>(task.progress ?? 0);

  // Sync when store pushes a real stage jump (upload→submitted→generating)
  useEffect(() => {
    setCrawlPct(prev => Math.max(prev, task.progress ?? 0)); // never go backward
  }, [task.progress]);

  // Start crawl once we hit the generating stage; stop when done
  useEffect(() => {
    if (!isKling || !isGenerating) return;
    const id = setInterval(() => {
      setCrawlPct(p => (p < 90 ? p + 1 : p));
    }, 8_000);
    return () => clearInterval(id);
  }, [isKling, isGenerating]);

  const displayProgress = isKling ? crawlPct : (task.progress ?? 0);
  const showProgressBar = (isKling && isGenerating) || (!isKling && isGenerating && displayProgress > 0);

  return (
    <div className={`bg-surface-1 border rounded-lg p-3.5 transition-colors ${
      isCompleted ? 'border-success/30' :
      isFailed    ? 'border-error/30'   :
      'border-border'
    }`}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isCompleted ? 'bg-success/10' :
          isFailed    ? 'bg-error/10'   :
          'bg-surface-2'
        }`}>
          {task.type === 'image'
            ? <ImageIcon size={18} className={isFailed ? 'text-error' : 'text-text-muted'} />
            : <Film      size={18} className={isFailed ? 'text-error' : 'text-text-muted'} />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-text-primary line-clamp-2 leading-snug">{task.prompt}</p>

          {/* Status row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {(isQueued || isGenerating) && <Loader2 size={13} className="animate-spin text-brand" />}
            {isCompleted && <CheckCircle size={13} className="text-success" />}
            {isFailed    && <AlertTriangle size={13} className="text-error" />}

            <span className={`text-xs font-medium ${statusColor[task.status]}`}>
              {statusLabel[task.status]}
            </span>

            {/* Seedance: queue position */}
            {isQueued && (task.queuePosition ?? -1) >= 0 && (
              <span className="text-xs text-warning font-mono bg-warning/10 px-1.5 py-0.5 rounded">
                第 {(task.queuePosition! + 1).toLocaleString()} 位
              </span>
            )}

            {/* Kling: stage message */}
            {isKling && isGenerating && task.statusMessage && (
              <span className="text-xs text-text-muted truncate max-w-[180px]">{task.statusMessage}</span>
            )}

            {isFailed && task.error && (
              <span className="text-xs text-error/70 truncate max-w-[180px]">{task.error}</span>
            )}
          </div>

          {/* Seedance queued: countdown */}
          {isQueued && minsLeft !== null && (
            <div className="flex items-center gap-1 mt-1.5">
              <Clock size={10} className="text-text-disabled" />
              <span className="text-[11px] text-text-disabled">
                {minsLeft > 0 ? `${minsLeft} 分钟后刷新排队进度` : '即将刷新...'}
              </span>
            </div>
          )}

          {/* Progress bar */}
          {showProgressBar && (
            <div className="mt-2">
              <span className="text-[10px] text-text-disabled block mb-1">{displayProgress}%</span>
              <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand rounded-full transition-all duration-[3000ms] ease-linear"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isFailed && (
            <button
              onClick={() => retryTask?.(task.id)}
              className="p-1 rounded-md hover:bg-brand/15 hover:text-brand text-text-muted transition-colors"
              title="重试"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {isCompleted && !task.downloaded && task.filePath && (
            <button
              onClick={() => downloadTask?.(task.id)}
              className="p-1 rounded-md hover:bg-success/15 hover:text-success text-text-muted transition-colors"
              title="下载"
            >
              <Download size={14} />
            </button>
          )}
          {isCompleted && task.filePath && (() => {
            const filePath = task.filePath;
            return (
              <button
                onClick={() => window.api.openFile?.(filePath)}
                className="p-1 rounded-md hover:bg-brand/15 hover:text-brand text-text-muted transition-colors"
                title="打开文件"
              >
                <Play size={14} />
              </button>
            );
          })()}
          <button
            onClick={() => deleteTask?.(task.id)}
            className="p-1 rounded-md hover:bg-error/15 hover:text-error text-text-muted transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}