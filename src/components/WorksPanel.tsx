import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, CheckCircle, AlertTriangle, Download, Play, Trash2, RefreshCw,
  LayoutGrid, List, FolderOpen, Film, Image as ImageIcon, X, ChevronDown,
  ChevronUp, Copy, Clock, Layers
} from 'lucide-react';
import { useStore, type TaskRecord, type BatchHistoryRecord, type BatchHistoryTask, type BatchTaskItem } from '../store';
import { localFileUrlSync } from '../utils/localFile';
import { parseTaskError, CATEGORY_COLORS, type ParsedError } from '../utils/errorMessages';
import { getOpenableLocalPath, isRemoteHttpUrl } from '../utils/filePath';

// ── Helpers ──────────────────────────────────────────────────────────────────

function toPlayable(url: string): string {
  if (!url) return '';
  if (url.startsWith('/') || /^[A-Za-z]:\\/.test(url)) return localFileUrlSync(url);
  return url;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function modelShort(m: string): string {
  const map: Record<string, string> = {
    'seedance2.0fast': 'S-Fast',
    'seedance2.0': 'S-2.0',
    'kling-o1': 'Kling',
  };
  return map[m] || m;
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-text-muted',
  queued: 'text-warning',
  generating: 'text-brand',
  uploading: 'text-brand',
  completed: 'text-success',
  downloaded: 'text-success',
  failed: 'text-error',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '等待中', queued: '排队中', generating: '生成中',
  uploading: '上传中', completed: '已完成', downloaded: '已下载', failed: '失败',
};

// ── TaskErrorDisplay ─────────────────────────────────────────────────────────
// Compact error block used inside failed task cards.

function TaskErrorDisplay({ rawError, source, onRetry, onFix }: {
  rawError: string | undefined | null;
  source: 'seedance' | 'kling';
  onRetry?: () => void;
  onFix?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseTaskError(rawError, source);
  const colors = CATEGORY_COLORS[parsed.category];

  return (
    <div className={`rounded border ${colors.border} ${colors.bg} px-2.5 py-2 space-y-1.5`}>
      {/* Title row */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-medium ${colors.text}`}>{parsed.title}</span>
        {rawError && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[9px] text-text-disabled hover:text-text-muted transition-colors"
          >
            {expanded ? '收起' : '详情'}
          </button>
        )}
      </div>

      {/* Message */}
      <p className="text-[11px] text-text-secondary leading-snug">{parsed.message}</p>

      {/* Raw error (expandable) */}
      {expanded && rawError && (
        <p className="text-[10px] text-text-disabled font-mono bg-black/20 rounded px-2 py-1 break-all">
          {rawError}
        </p>
      )}

      {/* Action button */}
      <div className="flex gap-2 pt-0.5">
        {parsed.retryable && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-[10px] text-brand hover:text-brand/80 font-medium transition-colors"
          >
            <RefreshCw size={10} />
            {parsed.actionLabel}
          </button>
        )}
        {!parsed.retryable && onFix && (
          <button
            onClick={onFix}
            className="flex items-center gap-1 text-[10px] text-brand hover:text-brand/80 font-medium transition-colors"
          >
            <RefreshCw size={10} />
            {parsed.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Batch queue card — same size/style as QueueCard ──────────────────────────

function BatchQueueCard() {
  const { batchTasks, batchInfo } = useStore();
  const [expanded, setExpanded] = useState(false);
  const hasActiveTasks = batchTasks.some((t: BatchTaskItem) =>
    ['pending', 'submitted', 'generating'].includes(t.status)
  );

  const total = batchTasks.length;
  if (total === 0 || !hasActiveTasks) return null;

  const doneBatch = batchTasks.filter((t: BatchTaskItem) =>
    ['completed', 'downloaded', 'failed'].includes(t.status)
  );
  const progressPct = Math.round((doneBatch.length / total) * 100);
  const isRunning = doneBatch.length < total;

  // Find the currently active sub-task for status display
  const activeTask = batchTasks.find((t: BatchTaskItem) =>
    ['submitted', 'generating'].includes(t.status)
  );
  const isQueuing   = activeTask && activeTask.queueStatus === 'Queuing';
  const isGenerating = activeTask && activeTask.queueStatus === 'Generating';

  let statusLabel: string;
  let statusColor: string;
  if (!isRunning)        { statusLabel = '已完成';  statusColor = 'text-success'; }
  else if (isQueuing)    { statusLabel = `排队第${activeTask!.queuePosition! + 1}位`; statusColor = 'text-warning'; }
  else if (isGenerating) { statusLabel = '生成中';  statusColor = 'text-brand'; }
  else                   { statusLabel = '提交中';  statusColor = 'text-brand'; }

  return (
    <div className="bg-surface-2 border border-border rounded-md p-3 flex flex-col gap-2 min-w-0">
      {/* Top row: status + badges */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isRunning
            ? <Loader2 size={11} className="animate-spin text-brand flex-shrink-0" />
            : <CheckCircle size={11} className="text-success flex-shrink-0" />
          }
          <span className={`text-[11px] font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">批量</span>
          <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">
            {doneBatch.length}/{total}
          </span>
        </div>
      </div>

      {/* Batch name / prompt summary */}
      <p className="text-xs text-text-secondary line-clamp-2 leading-snug">
        {batchInfo?.name || batchInfo?.description || batchTasks[0]?.prompt || '批量生成任务'}
      </p>

      {/* Progress bar */}
      <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] text-text-muted hover:text-brand transition-colors self-start"
      >
        {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {expanded ? '收起明细' : `查看 ${total} 条明细`}
      </button>

      {/* Sub-task rows (expandable) */}
      {expanded && (
        <div className="space-y-1">
          {batchTasks.map((t: BatchTaskItem, i: number) => {
            const isDone = ['completed', 'downloaded'].includes(t.status);
            const isFailed = t.status === 'failed';
            const isPending = t.status === 'pending';
            const isTaskActive = ['submitted', 'generating'].includes(t.status);
            const isTaskQueuing    = isTaskActive && t.queueStatus === 'Queuing';
            const isTaskGenerating = isTaskActive && t.queueStatus === 'Generating';

            let label: string;
            let color: string;
            if (isFailed)           { label = '失败';   color = 'text-error'; }
            else if (isDone)        { label = '完成';   color = 'text-success'; }
            else if (isPending)     { label = '待提交'; color = 'text-text-muted'; }
            else if (isTaskQueuing) { label = `排队第${t.queuePosition! + 1}位`; color = 'text-warning'; }
            else if (isTaskGenerating) { label = '生成中'; color = 'text-brand'; }
            else                    { label = '提交中'; color = 'text-brand'; }

            return (
              <div key={t.id} className={`flex items-center gap-2 px-1.5 py-1 rounded text-[11px] ${
                isFailed ? 'bg-error/8' : isDone ? 'bg-success/8' : 'bg-surface-3/50'
              }`}>
                <span className="text-[10px] font-mono text-text-disabled w-4 flex-shrink-0">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="flex-1 text-text-secondary truncate">{t.prompt}</p>
                {isTaskActive && <Loader2 size={10} className="animate-spin text-brand flex-shrink-0" />}
                {isDone && <CheckCircle size={10} className="text-success flex-shrink-0" />}
                {isFailed && <AlertTriangle size={10} className="text-error flex-shrink-0" />}
                <span className={`text-[10px] font-medium flex-shrink-0 ${color}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QueueCard({ task }: { task: TaskRecord }) {
  const isActive = ['generating', 'uploading'].includes(task.status);
  const isQueued = task.status === 'queued';
  const isKling = task.model === 'kling-o1';
  const progress = task.progress ?? 0;
  const statusText = isQueued && isKling && task.statusMessage
    ? task.statusMessage
    : isQueued && task.queuePosition != null
      ? `第 ${task.queuePosition + 1} 位`
      : STATUS_LABEL[task.status];

  // Dot color
  const dotColor = isActive
    ? 'bg-brand animate-pulse'
    : isQueued
      ? 'bg-warning'
      : task.status === 'failed'
        ? 'bg-error'
        : 'bg-success';

  return (
    <div className="bg-surface-2 border border-[rgba(255,255,255,0.08)] rounded-xl p-3 flex flex-col gap-2 min-w-0 max-w-[320px] active:scale-[0.97] transition-transform duration-150">
      {/* Top row: status dot + label + params */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className={`text-[11px] font-medium ${STATUS_COLOR[task.status]}`}>
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
            {modelShort(task.model)}
          </span>
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
            {task.duration}s
          </span>
        </div>
      </div>

      {/* Prompt */}
      <p className="text-xs text-text-secondary line-clamp-2 leading-snug">{task.prompt}</p>

      {/* Material thumbnails */}
      {task.materials?.length > 0 && (
        <div className="flex gap-1.5">
          {task.materials.slice(0, 4).map((m, i) => (
            <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border border-[rgba(255,255,255,0.08)] flex-shrink-0 bg-surface-3">
              {m.type === 'image'
                ? <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Film size={12} className="text-text-disabled" /></div>
              }
            </div>
          ))}
          {task.materials.length > 4 && (
            <div className="w-10 h-10 rounded-lg border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 bg-surface-3">
              <span className="text-[10px] text-text-disabled">+{task.materials.length - 4}</span>
            </div>
          )}
        </div>
      )}

      {/* Progress bar + percentage */}
      {(isActive || isKling) && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-0.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand rounded-full transition-[width] duration-[3000ms] ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] text-text-disabled flex-shrink-0 w-7 text-right">
              {progress}%
            </span>
          </div>
          {task.statusMessage && (
            <p className="text-[10px] text-text-disabled">{task.statusMessage}</p>
          )}
        </div>
      )}

      {/* Queue countdown */}
      {isQueued && task.nextPollAt && (
        <p className="text-[10px] text-text-disabled">
          {Math.max(0, Math.ceil((task.nextPollAt - Date.now()) / 60_000))} 分钟后刷新进度
        </p>
      )}
    </div>
  );
}

// ── Single task works card — grid mode ───────────────────────────────────────

function SingleCardGrid({ task, onPreview, onDelete, onRetry, highlighted = false }: {
  task: TaskRecord;
  onPreview: (url: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  highlighted?: boolean;
}) {
  const { downloadTask } = useStore();
  const isFailed = task.status === 'failed';
  const isDone = ['completed', 'downloaded'].includes(task.status);
  const cardRef = useRef<HTMLDivElement>(null);
  const openablePath = getOpenableLocalPath(task.localPath, task.filePath, task.resultUrl);
  const playUrl = task.localPath ? toPlayable(task.localPath) : task.resultUrl ? toPlayable(task.resultUrl) : '';
  const canManualDownload = Boolean(task.submitId || isRemoteHttpUrl(task.resultUrl));

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const handleDownload = useCallback(() => {
    if (openablePath) {
      window.api.openFile(openablePath);
      return;
    }
    if (task.status === 'completed' && canManualDownload) {
      void downloadTask(task.id);
    }
  }, [canManualDownload, downloadTask, openablePath, task]);

  return (
    <div
      ref={cardRef}
      className={`group bg-surface-1 border rounded-md overflow-hidden transition-colors ${
        highlighted
          ? 'border-brand shadow-[0_0_0_1px_rgba(54,118,255,0.28)]'
          : 'border-border-subtle hover:border-border'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-2 relative overflow-hidden">
        {task.thumbnailUrl ? (
          <img src={toPlayable(task.thumbnailUrl)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        ) : isDone && playUrl ? (
          <video src={playUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" muted preload="metadata" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isFailed
              ? <AlertTriangle size={24} className="text-error/50" />
              : <Film size={24} className="text-text-disabled" />}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          <span className="px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white/80 font-mono">
            {task.duration}s
          </span>
        </div>
        {task.status === 'downloaded' && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-success/80 text-[10px] text-white">已下载</span>
        )}
        {isFailed && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-error/80 text-[10px] text-white">失败</span>
        )}

        {/* Hover actions */}
        <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFailed && playUrl && (
            <button onClick={() => onPreview(playUrl)} className="p-1.5 rounded bg-black/60 hover:bg-brand text-white transition-colors">
              <Play size={12} />
            </button>
          )}
          {!isFailed && (openablePath || canManualDownload) && (
            <button onClick={handleDownload} className="p-1.5 rounded bg-black/60 hover:bg-brand text-white transition-colors">
              <Download size={12} />
            </button>
          )}
          {isFailed && (
            <button onClick={() => onRetry(task.id)} className="p-1.5 rounded bg-black/60 hover:bg-brand text-white transition-colors">
              <RefreshCw size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-text-primary line-clamp-2 leading-relaxed">{task.prompt || '无提示词'}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-text-disabled">{modelShort(task.model)}</span>
            <span className="text-[11px] text-text-disabled">·</span>
            <span className="text-[11px] text-text-disabled">{task.duration}s</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => navigator.clipboard.writeText(task.prompt)} className="p-1 text-text-disabled hover:text-brand transition-colors" title="复制提示词">
              <Copy size={11} />
            </button>
            <button onClick={() => onDelete(task.id)} className="p-1 text-text-disabled hover:text-error transition-colors" title="删除">
              <Trash2 size={11} />
            </button>
          </div>
        </div>
        {isFailed && (
          <div className="mt-2">
            <TaskErrorDisplay
              rawError={task.error}
              source={task.model === 'kling-o1' ? 'kling' : 'seedance'}
              onRetry={onRetry ? () => onRetry(task.id) : undefined}
              onFix={onRetry ? () => onRetry(task.id) : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single task works card — list mode ───────────────────────────────────────

function SingleCardList({ task, onPreview, onDelete, onRetry, highlighted = false }: {
  task: TaskRecord;
  onPreview: (url: string) => void;
  onDelete: (id: string) => void;
  onRetry: (id: string) => void;
  highlighted?: boolean;
}) {
  const { downloadTask } = useStore();
  const isFailed = task.status === 'failed';
  const cardRef = useRef<HTMLDivElement>(null);
  const openablePath = getOpenableLocalPath(task.localPath, task.filePath, task.resultUrl);
  const playUrl = task.localPath ? toPlayable(task.localPath) : task.resultUrl ? toPlayable(task.resultUrl) : '';
  const canManualDownload = Boolean(task.submitId || isRemoteHttpUrl(task.resultUrl));

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const handleDownload = useCallback(() => {
    if (openablePath) {
      window.api.openFile(openablePath);
      return;
    }
    if (task.status === 'completed' && canManualDownload) {
      void downloadTask(task.id);
    }
  }, [canManualDownload, downloadTask, openablePath, task]);

  return (
    <div
      ref={cardRef}
      className={`group flex items-center gap-3 bg-surface-1 border rounded-md p-3 transition-colors ${
        highlighted
          ? 'border-brand shadow-[0_0_0_1px_rgba(54,118,255,0.28)]'
          : 'border-border-subtle hover:border-border'
      }`}
    >
      {/* Thumbnail */}
      <div className="w-20 h-14 rounded-md overflow-hidden bg-surface-2 flex-shrink-0 relative">
        {task.thumbnailUrl
          ? <img src={toPlayable(task.thumbnailUrl)} alt="" className="w-full h-full object-cover" loading="lazy" />
          : !isFailed && playUrl
            ? <video src={playUrl} className="w-full h-full object-cover" muted preload="metadata" />
            : <div className="w-full h-full flex items-center justify-center">
                {isFailed ? <AlertTriangle size={16} className="text-error/50" /> : <Film size={16} className="text-text-disabled" />}
              </div>
        }
        {isFailed && <div className="absolute inset-0 bg-error/20" />}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary line-clamp-1">{task.prompt || '无提示词'}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[11px] ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          <span className="text-[11px] text-text-disabled">{modelShort(task.model)} · {task.duration}s · {fmtDate(task.createdAt)}</span>
        </div>
        {isFailed && (
          <p className={`text-[10px] mt-0.5 ${CATEGORY_COLORS[parseTaskError(task.error, task.model === 'kling-o1' ? 'kling' : 'seedance').category].text}`}>
            {parseTaskError(task.error, task.model === 'kling-o1' ? 'kling' : 'seedance').title}
            {task.error ? ` — ${task.error.slice(0, 50)}${task.error.length > 50 ? '…' : ''}` : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isFailed && playUrl && (
          <button onClick={() => onPreview(playUrl)} className="p-1.5 rounded bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors">
            <Play size={12} />
          </button>
        )}
        {!isFailed && (openablePath || canManualDownload) && (
          <button onClick={handleDownload} className="p-1.5 rounded bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors">
            <Download size={12} />
          </button>
        )}
        {isFailed && (
          <button onClick={() => onRetry(task.id)} className="p-1.5 rounded bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors">
            <RefreshCw size={12} />
          </button>
        )}
        <button onClick={() => onDelete(task.id)} className="p-1.5 rounded bg-surface-3 hover:bg-error hover:text-white text-text-muted transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Batch folder card — grid mode ─────────────────────────────────────────────

function BatchCardGrid({ record, onClick }: { record: BatchHistoryRecord; onClick: () => void }) {
  const doneCount = record.tasks.filter(t => t.status !== 'failed').length;
  const failCount = record.tasks.filter(t => t.status === 'failed').length;

  // Show first completed output as "cover" if available
  const cover = record.tasks.find(t => t.outputFile)?.outputFile;

  return (
    <div
      onClick={onClick}
      className="group bg-surface-1 border border-border-subtle rounded-md overflow-hidden hover:border-brand cursor-pointer transition-all hover:-translate-y-0.5"
    >
      {/* Cover thumbnail */}
      <div className="aspect-video bg-surface-2 relative overflow-hidden">
        {cover ? (
          <video src={toPlayable(cover)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" muted />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <Layers size={28} className="text-text-disabled" />
          </div>
        )}
        {/* Task count badge */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] text-white/90">
          {record.totalTasks} 个视频
        </div>
        {failCount > 0 && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-error/70 text-[10px] text-white">
            {failCount} 失败
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-brand/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-xs text-white bg-brand/80 px-3 py-1 rounded-full">查看详情</span>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs font-medium text-text-primary truncate">{record.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[11px] text-text-disabled">{modelShort(record.model)} · {record.duration}s · {record.aspectRatio}</span>
        </div>
        <div className="flex items-center gap-1 mt-1.5">
          <CheckCircle size={11} className="text-success" />
          <span className="text-[11px] text-success">{doneCount}</span>
          {failCount > 0 && <>
            <AlertTriangle size={11} className="text-error ml-1" />
            <span className="text-[11px] text-error">{failCount}</span>
          </>}
          <span className="text-[11px] text-text-disabled ml-auto">{fmtDate(record.completedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Batch folder card — list mode ─────────────────────────────────────────────

function BatchCardList({ record, onClick }: { record: BatchHistoryRecord; onClick: () => void }) {
  const doneCount = record.tasks.filter(t => t.status !== 'failed').length;
  const failCount = record.tasks.filter(t => t.status === 'failed').length;

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 bg-surface-1 border border-border-subtle rounded-md p-2.5 hover:border-brand cursor-pointer transition-colors"
    >
      <div className="w-10 h-10 rounded-md bg-surface-3 flex items-center justify-center flex-shrink-0">
        <Layers size={18} className="text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{record.name}</p>
        <p className="text-[10px] text-text-disabled mt-0.5">
          {modelShort(record.model)} · {record.duration}s · {record.aspectRatio}
          <span className="ml-2 text-success">✓{doneCount}</span>
          {failCount > 0 && <span className="ml-1 text-error">✗{failCount}</span>}
          <span className="ml-2">{fmtDate(record.completedAt)}</span>
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] text-brand">查看 →</span>
      </div>
    </div>
  );
}

// ── Batch detail drawer ───────────────────────────────────────────────────────

function BatchDrawer({ record, onClose }: { record: BatchHistoryRecord; onClose: () => void }) {
  const { setPreviewUrl, removeBatchHistory } = useStore();
  const zeroBasedIndex = useMemo(() => record.tasks.some(t => t.index === 0), [record.tasks]);

  const handleDownloadAll = useCallback(() => {
    const dir = record.tasks.find(t => t.outputFile)?.outputFile;
    if (dir) {
      // Open the folder containing the first output file
      const folderPath = dir.substring(0, dir.lastIndexOf('/') + 1) || dir.substring(0, dir.lastIndexOf('\\') + 1);
      if (folderPath) window.api.openFile(folderPath);
    }
  }, [record]);

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Scrim */}
      <div className="flex-1 bg-black/30 backdrop-blur-[2px]" />

      {/* Drawer panel */}
      <div
        className="w-[480px] bg-surface-0 border-l border-border flex flex-col h-full shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary truncate">{record.name}</h2>
            <p className="text-[11px] text-text-muted mt-0.5">{record.description || `共 ${record.totalTasks} 个视频`}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors ml-3 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Shared params bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle bg-surface-1 flex-shrink-0">
          <span className="text-[10px] text-text-muted uppercase tracking-wider mr-1">共享参数</span>
          {[modelShort(record.model), `${record.duration}s`, record.aspectRatio].map((tag, i) => (
            <span key={i} className="text-[10px] bg-surface-3 text-text-secondary px-2 py-0.5 rounded">{tag}</span>
          ))}
          {record.sharedMaterials.slice(0, 3).map((m, i) => (
            <div key={i} className="w-6 h-6 rounded overflow-hidden border border-border-subtle flex-shrink-0">
              {m.type === 'image'
                ? <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-surface-3 flex items-center justify-center"><Film size={10} className="text-text-disabled" /></div>
              }
            </div>
          ))}
          {record.sharedMaterials.length > 3 && (
            <span className="text-[10px] text-text-disabled">+{record.sharedMaterials.length - 3}</span>
          )}
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto py-3 px-4 space-y-2">
          {record.tasks.map((t) => (
            <BatchTaskRow
              key={t.index}
              task={t}
              onPreview={(url) => setPreviewUrl(url)}
              zeroBasedIndex={zeroBasedIndex}
            />
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle flex-shrink-0 bg-surface-1">
          <button
            onClick={() => { removeBatchHistory(record.id); onClose(); }}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-error transition-colors"
          >
            <Trash2 size={13} />
            删除记录
          </button>
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand/90 text-white text-xs rounded-md transition-colors"
          >
            <FolderOpen size={13} />
            打开文件夹
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Batch task row (inside drawer) ────────────────────────────────────────────

function BatchTaskRow({ task, onPreview, zeroBasedIndex }: {
  task: BatchHistoryTask;
  onPreview: (url: string) => void;
  zeroBasedIndex: boolean;
}) {
  const isFailed = task.status === 'failed';
  const isDone = !isFailed;
  const playUrl = task.outputFile ? toPlayable(task.outputFile) : '';
  const displayIndex = zeroBasedIndex ? task.index + 1 : task.index;

  return (
    <div className={`flex items-start gap-3 rounded-md p-2.5 border transition-colors ${
      isFailed ? 'border-error/20 bg-error/5' : 'border-border-subtle bg-surface-1'
    }`}>
      {/* Index */}
      <span className="text-[10px] font-mono text-text-muted bg-surface-3 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
        {String(displayIndex).padStart(2, '0')}
      </span>

      {/* Thumbnail */}
      <div className="w-16 h-10 rounded overflow-hidden bg-surface-2 flex-shrink-0 relative">
        {task.outputFile ? (
          <video src={playUrl} className="w-full h-full object-cover" muted />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isFailed
              ? <AlertTriangle size={12} className="text-error/60" />
              : <Film size={12} className="text-text-disabled" />
            }
          </div>
        )}
      </div>

      {/* Prompt + error */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-primary line-clamp-2 leading-snug">{task.prompt}</p>
        {isFailed && (
          <div className="mt-1.5">
            <TaskErrorDisplay
              rawError={task.error}
              source="seedance"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isDone && playUrl && (
          <button
            onClick={() => onPreview(playUrl)}
            className="p-1.5 rounded bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors"
            title="预览"
          >
            <Play size={11} />
          </button>
        )}
        {isDone && task.outputFile && (
          <button
            onClick={() => window.api.openFile(task.outputFile!)}
            className="p-1.5 rounded bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors"
            title="打开文件"
          >
            <Download size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Date group helper ─────────────────────────────────────────────────────────

function getDateGroup(ts: number): string {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= todayStart) return '今天';
  if (ts >= todayStart - 86400000) return '昨天';
  if (ts >= todayStart - 6 * 86400000) return '本周';
  return '更早';
}

// ── Main WorksPanel ───────────────────────────────────────────────────────────

export function WorksPanel() {
  const {
    tasks,
    batchTasks,
    batchHistory,
    retryTask,
    deleteTask,
    setPreviewUrl,
    highlightedTaskId,
    setHighlightedTaskId,
  } = useStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedBatch, setSelectedBatch] = useState<BatchHistoryRecord | null>(null);
  const hasActiveBatchTasks = useMemo(
    () => batchTasks.some(t => ['pending', 'submitted', 'generating'].includes(t.status)),
    [batchTasks]
  );

  // ── Partition tasks ──────────────────────────────────────────────────────
  const activeTasks = useMemo(
    () => tasks.filter(t => ['pending', 'queued', 'generating', 'uploading'].includes(t.status))
              .sort((a, b) => b.createdAt - a.createdAt),
    [tasks]
  );

  const doneTasks = useMemo(
    () => tasks.filter(t => ['completed', 'downloaded', 'failed'].includes(t.status))
              .sort((a, b) => (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt)),
    [tasks]
  );

  // ── Works: merge doneTasks + batchHistory, sorted by time ───────────────
  type WorkItem =
    | { kind: 'single'; task: TaskRecord; ts: number }
    | { kind: 'batch'; record: BatchHistoryRecord; ts: number };

  const allWorks = useMemo((): WorkItem[] => {
    const singles: WorkItem[] = doneTasks.map(t => ({ kind: 'single', task: t, ts: t.completedAt ?? t.createdAt }));
    const batches: WorkItem[] = batchHistory.map(b => ({ kind: 'batch', record: b, ts: b.completedAt }));
    return [...singles, ...batches].sort((a, b) => b.ts - a.ts);
  }, [doneTasks, batchHistory]);

  // ── Date-grouped works ───────────────────────────────────────────────────
  const groupedWorks = useMemo(() => {
    const groups: Record<string, WorkItem[]> = {};
    for (const item of allWorks) {
      const label = getDateGroup(item.ts);
      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    }
    const order = ['今天', '昨天', '本周', '更早'];
    return order.filter(l => groups[l]).map(l => ({ label: l, items: groups[l] }));
  }, [allWorks]);

  // ── Close drawer if the batch was deleted ────────────────────────────────
  useEffect(() => {
    if (selectedBatch && !batchHistory.find(b => b.id === selectedBatch.id)) {
      setSelectedBatch(null);
    }
  }, [batchHistory, selectedBatch]);

  useEffect(() => {
    if (!highlightedTaskId) return;
    const timer = window.setTimeout(() => setHighlightedTaskId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightedTaskId, setHighlightedTaskId]);

  const handleRetry = useCallback((id: string) => {
    retryTask(id);
  }, [retryTask]);

  const handleDelete = useCallback((id: string) => {
    deleteTask(id);
  }, [deleteTask]);

  const handlePreview = useCallback((url: string) => {
    setPreviewUrl(url);
  }, [setPreviewUrl]);

  return (
    <div className="flex flex-col h-full bg-surface-0 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <Film size={15} className="text-brand" />
          <h1 className="text-sm font-semibold text-text-primary">作品</h1>
          {allWorks.length > 0 && (
            <span className="text-[10px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded-full">
              {allWorks.length}
            </span>
          )}
        </div>
        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 bg-surface-2 rounded-md p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            title="网格视图"
          >
            <LayoutGrid size={13} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'bg-surface-3 text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
            title="列表视图"
          >
            <List size={13} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* ── Queue section ──────────────────────────────────────────────── */}
        {(activeTasks.length > 0 || hasActiveBatchTasks) && (
          <section className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-2.5">
              <Loader2 size={12} className="animate-spin text-brand" />
              <span className="text-xs font-medium text-text-secondary">生成队列</span>
              {(activeTasks.length + (hasActiveBatchTasks ? 1 : 0)) > 0 && (
                <span className="text-[10px] bg-brand/15 text-brand px-1.5 py-0.5 rounded-full">
                  {activeTasks.length + (hasActiveBatchTasks ? 1 : 0)}
                </span>
              )}
            </div>

            <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]' : 'grid-cols-1'}`}>
              <BatchQueueCard />
              {activeTasks.map(t => <QueueCard key={t.id} task={t} />)}
            </div>
          </section>
        )}

        {/* Divider */}
        {activeTasks.length > 0 && allWorks.length > 0 && (
          <div className="mx-4 my-3 border-t border-border-subtle" />
        )}

        {/* ── Works section ──────────────────────────────────────────────── */}
        {allWorks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mb-3">
              <Film size={24} className="text-text-disabled" />
            </div>
            <p className="text-sm font-medium text-text-secondary">暂无作品</p>
            <p className="text-[11px] text-text-muted mt-1">生成完成的视频会出现在这里</p>
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-6">
            {groupedWorks.map(group => (
              <section key={group.label}>
                <h3 className="text-[11px] font-medium text-text-muted mb-2.5 flex items-center gap-1.5">
                  {group.label}
                  <span className="text-[10px] text-text-disabled bg-surface-2 px-1.5 py-0.5 rounded-full">
                    {group.items.length}
                  </span>
                </h3>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
                    {group.items.map((item, i) =>
                      item.kind === 'single' ? (
                        <SingleCardGrid
                          key={item.task.id}
                          task={item.task}
                          onPreview={handlePreview}
                          onDelete={handleDelete}
                          onRetry={handleRetry}
                          highlighted={item.task.id === highlightedTaskId}
                        />
                      ) : (
                        <BatchCardGrid
                          key={item.record.id}
                          record={item.record}
                          onClick={() => setSelectedBatch(item.record)}
                        />
                      )
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {group.items.map((item) =>
                      item.kind === 'single' ? (
                        <SingleCardList
                          key={item.task.id}
                          task={item.task}
                          onPreview={handlePreview}
                          onDelete={handleDelete}
                          onRetry={handleRetry}
                          highlighted={item.task.id === highlightedTaskId}
                        />
                      ) : (
                        <BatchCardList
                          key={item.record.id}
                          record={item.record}
                          onClick={() => setSelectedBatch(item.record)}
                        />
                      )
                    )}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ── Batch detail drawer ─────────────────────────────────────────── */}
      {selectedBatch && (
        <BatchDrawer
          record={selectedBatch}
          onClose={() => setSelectedBatch(null)}
        />
      )}
    </div>
  );
}
