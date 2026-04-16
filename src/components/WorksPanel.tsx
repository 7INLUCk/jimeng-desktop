import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, CheckCircle, AlertTriangle, Download, Play, Trash2, RefreshCw,
  LayoutGrid, List, FolderOpen, Film, Image as ImageIcon, X, ChevronDown,
  ChevronUp, Copy, Check, Clock, Layers
} from 'lucide-react';
import { useStore, type TaskRecord, type BatchHistoryRecord, type BatchHistoryTask, type BatchTaskItem } from '../store';
import { localFileUrlSync } from '../utils/localFile';
import { parseTaskError, CATEGORY_COLORS, type ParsedError } from '../utils/errorMessages';
import { getOpenableLocalPath, isRemoteHttpUrl } from '../utils/filePath';
import { QueueDetailDrawer } from './QueueDetailDrawer';

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

function modelName(m: string): string {
  const map: Record<string, string> = {
    'seedance2.0fast': 'Seedance 2.0 Fast',
    'seedance2.0': 'Seedance 2.0',
    'kling-o1': 'Kling O1',
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

function getQueueStep(task: TaskRecord): 1 | 2 | 3 | 4 {
  if (task.status === 'completed' || task.status === 'downloaded') return 4;
  if (task.status === 'generating' && (task.progress ?? 0) > 0) return 3;
  if (task.status === 'queued') return 2;
  return 1; // pending / uploading / kling initial generating (progress=0)
}

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

// ── FailedFooter — compact expandable error strip ────────────────────────────

function FailedFooter({ error, model, onRetry }: {
  error?: string;
  model: string;
  onRetry: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseTaskError(error, model === 'kling-o1' ? 'kling' : 'seedance');

  return (
    <div className="border-t border-[rgba(255,255,255,0.06)]">
      {/* Summary row — always visible */}
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle size={11} className="text-error flex-shrink-0" />
        <span className="text-[11px] text-error truncate flex-1">{parsed.title}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          className="text-[10px] text-text-muted hover:text-brand transition-colors flex-shrink-0"
        >
          重试
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="text-[10px] text-text-disabled hover:text-text-muted transition-colors flex-shrink-0"
        >
          {expanded ? '收起' : '详情'}
        </button>
      </div>
      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-2.5">
          <p className="text-[11px] text-text-secondary leading-snug">{parsed.message}</p>
        </div>
      )}
    </div>
  );
}

// ── Batch queue card — same size/style as QueueCard ──────────────────────────

function BatchQueueCard({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const { batchTasks, batchInfo } = useStore();
  const settings = useStore(s => s.settings);

  const hasActiveTasks = batchTasks.some((t: BatchTaskItem) =>
    ['pending', 'submitted', 'generating'].includes(t.status)
  );

  const total = batchTasks.length;
  if (total === 0 || !hasActiveTasks) return null;

  const running = batchTasks.filter((t: BatchTaskItem) =>
    t.status === 'generating' || t.status === 'submitted'
  ).length;
  const waiting = batchTasks.filter((t: BatchTaskItem) => t.status === 'pending').length;
  const done = batchTasks.filter((t: BatchTaskItem) =>
    t.status === 'completed' || t.status === 'downloaded'
  ).length;
  const failed = batchTasks.filter((t: BatchTaskItem) => t.status === 'failed').length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const lastStepLabel = settings.autoDownload ? '下载中' : '已完成';

  // Sub-task list: running first then waiting, max 3
  const runningTasks = batchTasks.filter((t: BatchTaskItem) =>
    t.status === 'generating' || t.status === 'submitted'
  );
  const waitingTasks = batchTasks.filter((t: BatchTaskItem) => t.status === 'pending');
  const visibleTasks = [...runningTasks, ...waitingTasks].slice(0, 3);
  const hiddenCount = Math.max(0, total - visibleTasks.length - done - failed);

  const subDotColor = (t: BatchTaskItem): string => {
    if (t.status === 'completed' || t.status === 'downloaded') return 'bg-success';
    if (t.status === 'failed') return 'bg-error';
    if (t.status === 'generating' || t.status === 'submitted') return 'bg-brand animate-pulse';
    return 'bg-surface-3';
  };

  const subStatusLabel = (t: BatchTaskItem): string => {
    if (t.status === 'generating' || t.status === 'submitted') return '生成中';
    return '等待中';
  };

  return (
    <div className="bg-surface-2 border border-[rgba(255,255,255,0.08)] rounded-xl p-3 flex flex-col gap-2.5 min-w-0 max-w-[400px] active:scale-[0.97] transition-transform duration-150">
      {/* Row 1: batch name + model + duration + ratio */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-text-primary truncate flex-1 min-w-0">
          {batchInfo?.name || batchInfo?.description || '批量生成任务'}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {batchTasks[0]?.model && (
            <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
              {modelName(batchTasks[0].model)}
            </span>
          )}
          {batchTasks[0]?.duration && (
            <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
              {batchTasks[0].duration}s
            </span>
          )}
          {batchTasks[0]?.aspectRatio && (
            <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
              {batchTasks[0].aspectRatio}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: concurrency status row */}
      <div className="flex items-center gap-3 flex-wrap">
        {running > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse flex-shrink-0" />
            <span className="text-[10px] text-brand">运行中 {running}</span>
          </div>
        )}
        {waiting > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-surface-3 flex-shrink-0" />
            <span className="text-[10px] text-text-muted">等待中 {waiting}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
          <span className="text-[10px] text-success">{lastStepLabel} {done}</span>
        </div>
        {failed > 0 && (
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-error flex-shrink-0" />
            <span className="text-[10px] text-error">失败 {failed}</span>
          </div>
        )}
      </div>

      {/* Row 3: sub-task list (running/waiting, max 3) */}
      {visibleTasks.length > 0 && (
        <div className="space-y-1">
          {visibleTasks.map((t: BatchTaskItem) => (
            <div key={t.id} className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${subDotColor(t)}`} />
              <span className={`text-[10px] flex-shrink-0 ${
                t.status === 'generating' || t.status === 'submitted' ? 'text-brand' : 'text-text-muted'
              }`}>
                {subStatusLabel(t)}
              </span>
              <span className="text-[10px] text-text-disabled truncate flex-1">{t.prompt}</span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <p className="text-[10px] text-text-disabled text-right">+ {hiddenCount} 条</p>
          )}
        </div>
      )}

      {/* Row 4: overall progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-0.5 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-text-disabled flex-shrink-0">
          {done} / {total}
        </span>
      </div>

      {/* Row 5: 详情 button */}
      <div className="flex justify-end">
        <button
          onClick={onOpenDrawer}
          className="text-[11px] text-text-muted hover:text-brand transition-colors"
        >
          详情 ›
        </button>
      </div>
    </div>
  );
}

function QueueCard({ task, onOpenDrawer }: { task: TaskRecord; onOpenDrawer: (task: TaskRecord) => void }) {
  const settings = useStore(s => s.settings);
  const isActive = ['generating', 'uploading'].includes(task.status);
  const isQueued = task.status === 'queued';
  const isKling = task.model === 'kling-o1';
  const progress = task.progress ?? 0;
  const step = getQueueStep(task);

  const statusText = isQueued && isKling && task.statusMessage
    ? task.statusMessage
    : isQueued && task.queuePosition != null
      ? `第 ${task.queuePosition + 1} 位`
      : STATUS_LABEL[task.status];

  const dotColor = isActive
    ? 'bg-brand animate-pulse'
    : isQueued
      ? 'bg-warning'
      : task.status === 'failed'
        ? 'bg-error'
        : 'bg-success';

  // Supplement status text below progress bar
  let supplementText: string | null = null;
  if (task.status === 'queued' && !isKling && task.queuePosition != null) {
    supplementText = `队列第 ${task.queuePosition + 1} 位 / 共 ${task.queueLength ?? '?'} 位`;
  } else if (task.status === 'queued' && isKling) {
    supplementText = task.queuePosition != null ? `内部队列第 ${task.queuePosition} 位` : null;
  } else if (task.status === 'generating') {
    supplementText = task.statusMessage || '正在生成中…';
  }

  const lastStepLabel = settings.autoDownload ? '下载中' : '已完成';

  const STEPS = [
    { label: '提交中' },
    { label: '平台排队' },
    { label: '生成中' },
    { label: lastStepLabel },
  ];

  return (
    <div className="bg-surface-2 border border-[rgba(255,255,255,0.08)] rounded-xl p-3 flex flex-col gap-2.5 min-w-0 max-w-[400px] active:scale-[0.97] transition-transform duration-150">
      {/* Row 1: status dot + label + model + duration */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
          <span className={`text-[11px] font-medium ${STATUS_COLOR[task.status]}`}>
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
            {modelName(task.model)}
          </span>
          <span className="text-[10px] text-text-disabled bg-surface-3 px-1.5 py-0.5 rounded">
            {task.duration}s
          </span>
        </div>
      </div>

      {/* Row 2: prompt (3-line clamp) */}
      <p className="text-xs text-text-secondary line-clamp-3 leading-snug">{task.prompt}</p>

      {/* Row 2b: materials thumbnails */}
      {task.materials?.length > 0 && (
        <div className="flex gap-1.5">
          {task.materials.slice(0, 4).map((m, i) => (
            <div key={i} className="w-10 h-10 rounded-md overflow-hidden border border-[rgba(255,255,255,0.08)] flex-shrink-0 bg-surface-3">
              {m.type === 'image'
                ? <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Film size={12} className="text-text-disabled" /></div>
              }
            </div>
          ))}
          {task.materials.length > 4 && (
            <div className="w-10 h-10 rounded-md border border-[rgba(255,255,255,0.08)] flex items-center justify-center flex-shrink-0 bg-surface-3">
              <span className="text-[10px] text-text-disabled">+{task.materials.length - 4}</span>
            </div>
          )}
        </div>
      )}

      {/* Row 3: 4-step status pipeline */}
      <div className="flex items-start">
        {STEPS.map((s, i) => {
          const stepNum = (i + 1) as 1 | 2 | 3 | 4;
          const isPast = step > stepNum;
          const isCurrent = step === stepNum;
          return (
            <div key={i} className="flex items-start flex-1 min-w-0">
              {/* Connector line before (not for first) */}
              {i > 0 && (
                <div className={`flex-1 h-px mt-1 ${isPast || isCurrent ? 'bg-success' : 'border-t border-dashed border-surface-3'}`} />
              )}
              {/* Step dot + label */}
              <div className="flex flex-col items-center gap-0.5 px-0.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isCurrent ? 'bg-brand ring-2 ring-brand/30' :
                  isPast ? 'bg-success' :
                  'bg-surface-3'
                }`} />
                <span className={`text-[9px] whitespace-nowrap leading-tight text-center ${
                  isCurrent ? 'text-brand font-medium' :
                  isPast ? 'text-success' :
                  'text-text-disabled'
                }`}>{s.label}</span>
              </div>
              {/* Connector line after (not for last) */}
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mt-1 ${isPast ? 'bg-success' : 'border-t border-dashed border-surface-3'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Row 4: progress bar + supplement text */}
      {(isActive || isQueued || isKling) && (
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
          {supplementText && (
            <p className="text-[10px] text-text-disabled">{supplementText}</p>
          )}
        </div>
      )}

      {/* Row 5: 详情 button */}
      <div className="flex justify-end">
        <button
          onClick={() => onOpenDrawer(task)}
          className="text-[11px] text-text-muted hover:text-brand transition-colors"
        >
          详情 ›
        </button>
      </div>
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
  const { downloadTask, settings } = useStore();
  const isFailed = task.status === 'failed';
  const isDone = ['completed', 'downloaded'].includes(task.status);
  const cardRef = useRef<HTMLDivElement>(null);
  const openablePath = getOpenableLocalPath(task.localPath, task.filePath, task.resultUrl);
  const playUrl = task.localPath ? toPlayable(task.localPath) : task.resultUrl ? toPlayable(task.resultUrl) : '';
  const canManualDownload = Boolean(task.submitId || isRemoteHttpUrl(task.resultUrl));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [folderClicked, setFolderClicked] = useState(false);

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const suggestedName = useMemo(() => {
    const base = (task.prompt || 'video').slice(0, 20).replace(/[^\w\u4e00-\u9fa5]/g, '_');
    return `${base}_${task.model}_${task.duration}s.mp4`;
  }, [task.prompt, task.model, task.duration]);

  const handleConfirmDelete = useCallback(async () => {
    if (task.localPath) {
      await window.api.deleteFile(task.localPath).catch(() => {});
    }
    onDelete(task.id);
  }, [task.id, task.localPath, onDelete]);

  const handleCopy = useCallback(() => {
    if (isFailed) return;
    navigator.clipboard.writeText(task.prompt || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [isFailed, task.prompt]);

  const handleDownload = useCallback(async () => {
    if (settings.autoDownload && openablePath) {
      setFolderClicked(true);
      await window.api.showItemInFolder(openablePath);
      setTimeout(() => setFolderClicked(false), 800);
    } else if (!settings.autoDownload && openablePath) {
      await window.api.saveFileAs({ srcPath: openablePath, suggestedName });
    } else if (canManualDownload) {
      void downloadTask(task.id);
    }
  }, [settings.autoDownload, openablePath, suggestedName, canManualDownload, downloadTask, task.id]);

  return (
    <div
      ref={cardRef}
      onClick={() => { if (!isFailed && playUrl) onPreview(playUrl); }}
      className={`group relative bg-surface-1 border rounded-2xl cursor-pointer
        active:scale-[0.97] transition-all duration-150 ${
        highlighted
          ? 'border-brand shadow-[0_0_0_1px_rgba(54,118,255,0.28)]'
          : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)]'
      }`}
    >
      {/* Thumbnail — overflow-hidden lives here, not on outer div */}
      <div className="aspect-square bg-surface-2 relative overflow-hidden rounded-t-2xl">
        {task.thumbnailUrl ? (
          <img
            src={toPlayable(task.thumbnailUrl)}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : isDone && playUrl ? (
          <video
            src={playUrl}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            muted
            preload="metadata"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isFailed
              ? <AlertTriangle size={24} className="text-error/50" />
              : <Film size={24} className="text-text-disabled" />
            }
          </div>
        )}

        {/* Top-left badges: mode | quantity | status (always 3 pills) */}
        <div className="absolute top-2 left-2 flex gap-1">
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/60">单个</span>
          <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">1 个</span>
          {isFailed
            ? <span className="px-1.5 py-0.5 rounded-md bg-error/80 text-[10px] text-white">失败</span>
            : task.status === 'downloaded'
              ? <span className="px-1.5 py-0.5 rounded-md bg-success/80 text-[10px] text-white">已下载</span>
              : <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">已完成</span>
          }
        </div>

        {/* Hover play overlay (success only) */}
        {!isFailed && playUrl && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
            <Play size={40} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}
      </div>

      {/* Info section — fixed 3-row structure regardless of state */}
      <div className="px-3 pt-2.5 pb-1">
        {/* Row 1: prompt — min-h reserves 2 lines so short prompts don't shrink the card */}
        <p className="text-[12px] text-text-secondary line-clamp-2 leading-snug min-h-[2.0625rem]">
          {task.prompt || '无提示词'}
        </p>
        {/* Row 2: model · duration · ratio */}
        <p className="text-[11px] text-text-muted mt-1">
          {modelName(task.model)} · {task.duration}s{task.aspectRatio ? ` · ${task.aspectRatio}` : ''}
        </p>
        {/* Row 3: date (success) or error title (failed) — same line, same height */}
        <p className="text-[11px] mt-0.5 truncate">
          {isFailed
            ? <span className="text-error flex items-center gap-1">
                <AlertTriangle size={10} className="inline flex-shrink-0" />
                {parseTaskError(task.error, task.model === 'kling-o1' ? 'kling' : 'seedance').title}
              </span>
            : <span className="text-text-disabled">{task.completedAt ? fmtDate(task.completedAt) : ''}</span>
          }
        </p>
      </div>

      {/* Action row — always same height; confirm replaces buttons in-place */}
      <div className="flex items-center gap-1 px-3 pb-2.5" onClick={e => e.stopPropagation()}>
        {showDeleteConfirm ? (
          /* Confirm strip — same height as button row, no layout shift */
          <>
            <span className="flex-1 text-[11px] text-error truncate">
              {task.localPath ? '同时删除本地文件？' : '删除任务记录？'}
            </span>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 rounded-md text-[11px] text-text-muted hover:text-text-primary transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-2 py-1 rounded-md text-[11px] bg-error/15 text-error hover:bg-error hover:text-white font-medium transition-colors"
            >
              删除
            </button>
          </>
        ) : (
          <>
            {/* Slot 1: copy (success) or invisible placeholder (failed) */}
            <div className="relative group/copy">
              <button
                onClick={handleCopy}
                className={`p-1.5 rounded-lg transition-colors ${
                  isFailed
                    ? 'invisible'
                    : copied
                      ? 'bg-success/20 text-success'
                      : 'bg-surface-3 hover:bg-surface-2 text-text-muted hover:text-text-primary'
                }`}
                tabIndex={isFailed ? -1 : undefined}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              {!isFailed && (
                <div className="absolute bottom-full right-0 mb-1 px-1.5 py-0.5 bg-surface-0 border border-[rgba(255,255,255,0.1)] rounded text-[10px] text-text-secondary whitespace-nowrap opacity-0 group-hover/copy:opacity-100 transition-opacity pointer-events-none z-50">
                  {copied ? '已复制' : '复制提示词'}
                </div>
              )}
            </div>
            {/* Slot 2: download/folder (success+file) or retry (failed) or invisible (success+no file) */}
            {isFailed ? (
              <button
                onClick={() => onRetry(task.id)}
                className="p-1.5 rounded-lg bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors"
                title="重试"
              >
                <RefreshCw size={12} />
              </button>
            ) : (openablePath || canManualDownload) ? (
              <button
                onClick={handleDownload}
                className={`p-1.5 rounded-lg transition-colors ${
                  folderClicked
                    ? 'bg-success/20 text-success'
                    : 'bg-surface-3 hover:bg-surface-2 text-text-muted hover:text-text-primary'
                }`}
                title={settings.autoDownload && openablePath ? '在文件夹中显示' : '下载'}
              >
                {settings.autoDownload && openablePath ? <FolderOpen size={12} /> : <Download size={12} />}
              </button>
            ) : (
              <span className="invisible p-1.5"><Download size={12} /></span>
            )}
            {/* Slot 3: delete (always) */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg bg-surface-3 hover:bg-error hover:text-white text-text-muted transition-colors"
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          </>
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
  const { downloadTask, settings } = useStore();
  const isFailed = task.status === 'failed';
  const cardRef = useRef<HTMLDivElement>(null);
  const openablePath = getOpenableLocalPath(task.localPath, task.filePath, task.resultUrl);
  const playUrl = task.localPath ? toPlayable(task.localPath) : task.resultUrl ? toPlayable(task.resultUrl) : '';
  const canManualDownload = Boolean(task.submitId || isRemoteHttpUrl(task.resultUrl));
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [folderClicked, setFolderClicked] = useState(false);

  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlighted]);

  const suggestedName = useMemo(() => {
    const base = (task.prompt || 'video').slice(0, 20).replace(/[^\w\u4e00-\u9fa5]/g, '_');
    return `${base}_${task.model}_${task.duration}s.mp4`;
  }, [task.prompt, task.model, task.duration]);

  const handleConfirmDelete = useCallback(async () => {
    if (task.localPath) {
      await window.api.deleteFile(task.localPath).catch(() => {});
    }
    onDelete(task.id);
  }, [task.id, task.localPath, onDelete]);

  const handleDownload = useCallback(async () => {
    if (settings.autoDownload && openablePath) {
      setFolderClicked(true);
      await window.api.showItemInFolder(openablePath);
      setTimeout(() => setFolderClicked(false), 800);
    } else if (!settings.autoDownload && openablePath) {
      await window.api.saveFileAs({ srcPath: openablePath, suggestedName });
    } else if (canManualDownload) {
      void downloadTask(task.id);
    }
  }, [settings.autoDownload, openablePath, suggestedName, canManualDownload, downloadTask, task.id]);

  return (
    <div ref={cardRef}>
      <div
        onClick={() => { if (!isFailed && playUrl) onPreview(playUrl); }}
        className={`group flex items-center gap-3 bg-surface-1 border rounded-xl p-3
          active:scale-[0.97] transition-all duration-150 cursor-pointer ${
          highlighted
            ? 'border-brand shadow-[0_0_0_1px_rgba(54,118,255,0.28)]'
            : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.16)]'
        }`}
      >
        {/* Thumbnail */}
        <div className="w-20 h-14 rounded-lg overflow-hidden bg-surface-2 flex-shrink-0 relative">
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

        {/* Text — fixed 2-row structure regardless of state */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-primary line-clamp-1">{task.prompt || '无提示词'}</p>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <span className={`text-[11px] flex-shrink-0 ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
            {isFailed && (
              <>
                <span className="text-[11px] text-text-disabled flex-shrink-0">·</span>
                <span className="text-[11px] text-error truncate">
                  {parseTaskError(task.error, task.model === 'kling-o1' ? 'kling' : 'seedance').title}
                </span>
              </>
            )}
            <span className="text-[11px] text-text-disabled truncate flex-shrink-0 ml-auto">
              {modelName(task.model)} · {task.duration}s
            </span>
          </div>
        </div>

        {/* Actions — confirm replaces buttons in-place, no layout shift */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {showDeleteConfirm ? (
            <>
              <span className="text-[11px] text-error mr-1 whitespace-nowrap">
                {task.localPath ? '删除文件？' : '删除记录？'}
              </span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 rounded-md text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-2 py-1 rounded-md text-[11px] bg-error/15 text-error hover:bg-error hover:text-white font-medium transition-colors"
              >
                删除
              </button>
            </>
          ) : (
            <>
              <div className="opacity-50 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                {!isFailed && playUrl && (
                  <button onClick={() => onPreview(playUrl)} className="p-1.5 rounded-lg bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors" title="预览">
                    <Play size={12} />
                  </button>
                )}
                {!isFailed && (openablePath || canManualDownload) && (
                  <button
                    onClick={handleDownload}
                    className={`p-1.5 rounded-lg transition-colors ${
                      folderClicked
                        ? 'bg-success/20 text-success'
                        : 'bg-surface-3 hover:bg-brand hover:text-white text-text-muted'
                    }`}
                    title={settings.autoDownload && openablePath ? '在文件夹中显示' : '下载'}
                  >
                    {settings.autoDownload && openablePath ? <FolderOpen size={12} /> : <Download size={12} />}
                  </button>
                )}
                {isFailed && (
                  <button onClick={() => onRetry(task.id)} className="p-1.5 rounded-lg bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors" title="重试">
                    <RefreshCw size={12} />
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-lg bg-surface-3 hover:bg-error hover:text-white text-text-muted transition-colors"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Batch folder card — grid mode ─────────────────────────────────────────────

function BatchCardGrid({ record, onClick }: { record: BatchHistoryRecord; onClick: () => void }) {
  const { removeBatchHistory } = useStore();
  const doneCount = record.tasks.filter(t => t.status !== 'failed').length;
  const failCount = record.tasks.filter(t => t.status === 'failed').length;
  const allDownloaded = record.tasks.length > 0 && record.tasks.every(t => !!t.outputFile);
  const cover = record.tasks.find(t => t.outputFile)?.outputFile;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [folderClicked, setFolderClicked] = useState(false);

  const handleOpenFolder = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cover) return;
    setFolderClicked(true);
    await window.api.showItemInFolder(cover);
    setTimeout(() => setFolderClicked(false), 800);
  }, [cover]);

  const handleConfirmDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    for (const t of record.tasks) {
      if (t.outputFile) await window.api.deleteFile(t.outputFile).catch(() => {});
    }
    removeBatchHistory(record.id);
  }, [record.tasks, record.id, removeBatchHistory]);

  // A: collect first 4 output files for 2×2 grid
  const coverTasks = record.tasks.filter(t => t.outputFile).slice(0, 4);

  return (
    // Outer wrapper — no padding needed; layers overflow into gap naturally
    <div
      className="relative cursor-pointer group"
      onClick={onClick}
    >
      {/* Layer 3 — back (C: stronger: opacity 0.55, offset 8px, brand-tinted border) */}
      <div
        className="absolute inset-0 bg-surface-1 border border-brand/10 rounded-2xl opacity-[0.55]"
        style={{ transform: 'translate(8px, 8px) scale(0.93)', zIndex: 0 }}
      />
      {/* Layer 2 — mid (C: stronger: opacity 0.88, offset 4px, brand-tinted border) */}
      <div
        className="absolute inset-0 bg-surface-1 border border-brand/[0.14] rounded-2xl opacity-[0.88]"
        style={{ transform: 'translate(4px, 4px) scale(0.96)', zIndex: 1 }}
      />

      {/* Layer 1 — front (actual card) — C: stronger border rgba(0.18) */}
      <div
        className="relative bg-surface-1 border border-[rgba(255,255,255,0.18)] rounded-2xl overflow-hidden
          transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.97]"
        style={{ zIndex: 2 }}
      >
        {/* Adaptive thumbnail grid: 0=icon, 1=full, 2=side-by-side, 3=Instagram, 4=2×2 */}
        <div className="aspect-square bg-surface-2 relative overflow-hidden">
          {coverTasks.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1">
              <Layers size={28} className="text-text-disabled" />
            </div>
          ) : coverTasks.length === 1 ? (
            <video
              src={toPlayable(coverTasks[0].outputFile!)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              muted
            />
          ) : coverTasks.length === 2 ? (
            // 2×1: two columns
            <div className="w-full h-full grid grid-cols-2 gap-[2px]">
              {coverTasks.map((t, i) => (
                <div key={i} className="relative overflow-hidden bg-surface-3">
                  <video src={toPlayable(t.outputFile!)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
                </div>
              ))}
            </div>
          ) : coverTasks.length === 3 ? (
            // Instagram 3: left=tall, right=2 stacked
            <div className="w-full h-full flex gap-[2px]">
              <div className="flex-1 relative overflow-hidden bg-surface-3">
                <video src={toPlayable(coverTasks[0].outputFile!)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
              </div>
              <div className="flex-1 flex flex-col gap-[2px]">
                <div className="flex-1 relative overflow-hidden bg-surface-3">
                  <video src={toPlayable(coverTasks[1].outputFile!)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
                </div>
                <div className="flex-1 relative overflow-hidden bg-surface-3">
                  <video src={toPlayable(coverTasks[2].outputFile!)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
                </div>
              </div>
            </div>
          ) : (
            // 4: 2×2 grid
            <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-[2px]">
              {coverTasks.map((t, i) => (
                <div key={i} className="relative overflow-hidden bg-surface-3">
                  <video src={toPlayable(t.outputFile!)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted />
                </div>
              ))}
            </div>
          )}

          {/* Top-left badges: mode | quantity | status (always 3 pills) */}
          <div className="absolute top-2 left-2 flex gap-1">
            <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/60">批量</span>
            <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">{record.totalTasks} 个</span>
            {failCount > 0
              ? <span className="px-1.5 py-0.5 rounded-md bg-error/80 text-[10px] text-white">{failCount} 失败</span>
              : allDownloaded
                ? <span className="px-1.5 py-0.5 rounded-md bg-success/80 text-[10px] text-white">已下载</span>
                : <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/80">已完成</span>
            }
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-brand/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-xs text-white bg-brand/80 px-3 py-1 rounded-full">查看详情</span>
          </div>
        </div>

        {/* Info — 3-row structure mirroring SingleCardGrid for height parity */}
        <div className="px-3 pt-2.5 pb-1">
          {/* Row 1: batch name — min-h matches SingleCardGrid 2-line prompt height */}
          <p className="text-[12px] font-medium text-text-primary leading-snug min-h-[2.0625rem] truncate">
            {record.name}
          </p>
          {/* Row 2: model · duration · ratio */}
          <p className="text-[11px] text-text-muted mt-1">
            {modelName(record.model)} · {record.duration}s · {record.aspectRatio}
          </p>
          {/* Row 3: date — mirrors SingleCardGrid */}
          <p className="text-[11px] text-text-disabled mt-0.5">{fmtDate(record.completedAt)}</p>
        </div>

        {/* Action row — same layout as SingleCardGrid (no justify-end) */}
        <div className="flex items-center gap-1 px-3 pb-2.5" onClick={e => e.stopPropagation()}>
          {showDeleteConfirm ? (
            <>
              <span className="flex-1 text-[11px] text-error truncate">同时删除文件？</span>
              <button
                onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                className="px-2 py-1 rounded-md text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-2 py-1 rounded-md text-[11px] bg-error/15 text-error hover:bg-error hover:text-white font-medium transition-colors"
              >
                删除
              </button>
            </>
          ) : (
            <>
              {/* Placeholder aligns with copy slot in SingleCardGrid */}
              <span className="invisible p-1.5"><Copy size={12} /></span>
              {/* Open folder (only when outputs exist) */}
              {cover ? (
                <button
                  onClick={handleOpenFolder}
                  className={`p-1.5 rounded-lg transition-colors ${
                    folderClicked
                      ? 'bg-success/20 text-success'
                      : 'bg-surface-3 hover:bg-surface-2 text-text-muted hover:text-text-primary'
                  }`}
                  title="打开文件夹"
                >
                  <FolderOpen size={12} />
                </button>
              ) : (
                <span className="invisible p-1.5"><FolderOpen size={12} /></span>
              )}
              {/* Delete batch */}
              <button
                onClick={e => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                className="p-1.5 rounded-lg bg-surface-3 hover:bg-error hover:text-white text-text-muted transition-colors"
                title="删除批次"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
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
      className="group flex items-center gap-3 bg-surface-1 border border-[rgba(255,255,255,0.08)] rounded-xl p-2.5
        hover:border-[rgba(255,255,255,0.16)] cursor-pointer transition-all duration-150 active:scale-[0.97]"
    >
      <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
        <Layers size={18} className="text-brand" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{record.name}</p>
        <p className="text-[10px] text-text-disabled mt-0.5">
          {modelName(record.model)} · {record.duration}s · {record.aspectRatio}
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
          {[modelName(record.model), `${record.duration}s`, record.aspectRatio].map((tag, i) => (
            <span key={i} className="text-[10px] bg-surface-3 text-text-secondary px-2 py-0.5 rounded">{tag}</span>
          ))}
          {record.sharedMaterials.slice(0, 3).map((m, i) => (
            <button
              key={i}
              className="w-8 h-8 rounded overflow-hidden border border-border-subtle flex-shrink-0 cursor-pointer hover:ring-1 hover:ring-brand transition-all"
              onClick={() => {
                if (m.type === 'image') window.api.openFile(m.path);
                else setPreviewUrl(toPlayable(m.path));
              }}
              title={m.path}
            >
              {m.type === 'image'
                ? <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-surface-3 flex items-center justify-center"><Film size={12} className="text-text-disabled" /></div>
              }
            </button>
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
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-error transition-colors"
            >
              <Trash2 size={13} />
              删除记录
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-error">同时删除本地文件？</span>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={async () => {
                  for (const t of record.tasks) {
                    if (t.outputFile) {
                      await window.api.deleteFile(t.outputFile).catch(() => {});
                    }
                  }
                  removeBatchHistory(record.id);
                  onClose();
                }}
                className="text-[11px] text-error hover:text-error/80 font-medium transition-colors"
              >
                删除
              </button>
            </div>
          )}
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
  const { settings } = useStore();
  const isFailed = task.status === 'failed';
  const isDone = !isFailed;
  const playUrl = task.outputFile ? toPlayable(task.outputFile) : '';
  const displayIndex = zeroBasedIndex ? task.index + 1 : task.index;

  const suggestedName = useMemo(() => {
    const base = (task.prompt || 'video').slice(0, 20).replace(/[^\w\u4e00-\u9fa5]/g, '_');
    return `${base}_batch_${task.index}.mp4`;
  }, [task.prompt, task.index]);

  const handleDownload = useCallback(async () => {
    if (!task.outputFile) return;
    if (settings.autoDownload) {
      await window.api.showItemInFolder(task.outputFile);
    } else {
      await window.api.saveFileAs({ srcPath: task.outputFile, suggestedName });
    }
  }, [settings.autoDownload, task.outputFile, suggestedName]);

  return (
    <div
      onClick={() => { if (isDone && playUrl) onPreview(playUrl); }}
      className={`flex items-start gap-3 rounded-md p-2.5 border transition-colors cursor-pointer ${
        isFailed ? 'border-error/20 bg-error/5' : 'border-border-subtle bg-surface-1 hover:border-[rgba(255,255,255,0.16)]'
      }`}
    >
      {/* Index */}
      <span className="text-[10px] font-mono text-text-muted bg-surface-3 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
        {String(displayIndex).padStart(2, '0')}
      </span>

      {/* Thumbnail — square 1:1 */}
      <div className="w-14 h-14 rounded overflow-hidden bg-surface-2 flex-shrink-0 relative">
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

      {/* Actions — stopPropagation so row-click doesn't fire */}
      <div
        className="flex items-center gap-1 flex-shrink-0"
        onClick={e => e.stopPropagation()}
      >
        {isDone && task.outputFile && (
          <button
            onClick={handleDownload}
            className="p-1.5 rounded bg-surface-3 hover:bg-brand hover:text-white text-text-muted transition-colors"
            title={settings.autoDownload ? '在文件夹中显示' : '另存为'}
          >
            {settings.autoDownload ? <FolderOpen size={11} /> : <Download size={11} />}
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTask, setDrawerTask] = useState<TaskRecord | null>(null);
  const [drawerIsBatch, setDrawerIsBatch] = useState(false);
  const hasActiveBatchTasks = useMemo(
    () => batchTasks.some(t => ['pending', 'submitted', 'generating'].includes(t.status)),
    [batchTasks]
  );

  const handleOpenSingleDrawer = useCallback((task: TaskRecord) => {
    setDrawerTask(task);
    setDrawerIsBatch(false);
    setDrawerOpen(true);
  }, []);

  const handleOpenBatchDrawer = useCallback(() => {
    setDrawerTask(null);
    setDrawerIsBatch(true);
    setDrawerOpen(true);
  }, []);

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

            <div className={`grid gap-3 items-start ${viewMode === 'grid' ? 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]' : 'grid-cols-1'}`}>
              <BatchQueueCard onOpenDrawer={handleOpenBatchDrawer} />
              {activeTasks.map(t => <QueueCard key={t.id} task={t} onOpenDrawer={handleOpenSingleDrawer} />)}
            </div>
          </section>
        )}

        {/* Divider */}
        {activeTasks.length > 0 && allWorks.length > 0 && (
          <div className="mx-4 my-3 border-t border-border-subtle" />
        )}

        {/* ── Works section ──────────────────────────────────────────────── */}
        {allWorks.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 min-h-[16rem] text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-surface-2 flex items-center justify-center mb-4">
              <Film size={32} className="text-text-disabled" />
            </div>
            <p className="text-sm font-semibold text-text-secondary">还没有作品</p>
            <p className="text-[11px] text-text-muted mt-1.5">生成完成的视频会在这里展示</p>
            <button
              className="mt-4 px-4 py-1.5 rounded-lg bg-brand/15 text-brand text-xs hover:bg-brand/25 transition-colors active:scale-[0.97]"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-chat'))}
            >
              去创作第一个视频
            </button>
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-6">
            {groupedWorks.map(group => (
              <section key={group.label}>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-[11px] font-medium text-text-muted flex-shrink-0">{group.label}</span>
                  <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
                  <span className="text-[10px] text-text-disabled flex-shrink-0">{group.items.length}</span>
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 items-start">
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

      {/* ── Queue detail drawer ─────────────────────────────────────────── */}
      <QueueDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        task={drawerIsBatch ? undefined : drawerTask ?? undefined}
        batchTasks={drawerIsBatch ? batchTasks : undefined}
        batchInfo={drawerIsBatch ? useStore.getState().batchInfo : undefined}
      />
    </div>
  );
}
