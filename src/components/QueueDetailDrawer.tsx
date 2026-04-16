import { useRef, useEffect, useState } from 'react';
import { X, Film } from 'lucide-react';
import { type TaskRecord, type BatchTaskItem, type BatchInfo } from '../store';
import { localFileUrlSync } from '../utils/localFile';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DRAWER_STATUS_LABEL: Record<string, string> = {
  pending: '提交中', uploading: '上传中', queued: '排队中',
  generating: '生成中', completed: '已完成', downloaded: '已下载', failed: '失败',
};

const DRAWER_STATUS_COLOR: Record<string, string> = {
  pending: 'text-text-muted', uploading: 'text-brand', queued: 'text-warning',
  generating: 'text-brand', completed: 'text-success', downloaded: 'text-success', failed: 'text-error',
};

const DRAWER_DOT_COLOR: Record<string, string> = {
  pending: 'bg-surface-3', uploading: 'bg-brand animate-pulse', queued: 'bg-warning',
  generating: 'bg-brand animate-pulse', completed: 'bg-success', downloaded: 'bg-success', failed: 'bg-error',
};

function fmtTime(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function modelLabel(m: string): string {
  const map: Record<string, string> = {
    'seedance2.0fast': 'Seedance 2.0 Fast',
    'seedance2.0': 'Seedance 2.0',
    'kling-o1': 'Kling O1',
  };
  return map[m] || m;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QueueDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  // single task
  task?: TaskRecord;
  // batch task
  batchTasks?: BatchTaskItem[];
  batchInfo?: BatchInfo | null;
}

// ── Single Task Drawer Content ────────────────────────────────────────────────

interface StatusLogEntry {
  time: string;
  label: string;
  isCurrent: boolean;
}

function SingleDrawerContent({ task, onClose }: { task: TaskRecord; onClose: () => void }) {
  const logsRef = useRef<StatusLogEntry[]>([]);
  const [, forceUpdate] = useState(0);
  const prevStatusRef = useRef<string>('');
  const prevQueuePositionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const statusChanged = task.status !== prevStatusRef.current;
    const positionChanged = task.queuePosition !== prevQueuePositionRef.current;

    if (statusChanged || logsRef.current.length === 0) {
      prevStatusRef.current = task.status;
      prevQueuePositionRef.current = task.queuePosition;

      let label = DRAWER_STATUS_LABEL[task.status] || task.status;
      if (task.status === 'queued' && task.queuePosition != null) {
        label += `（第 ${task.queuePosition + 1} 位）`;
      }

      const newEntries = logsRef.current.map(e => ({ ...e, isCurrent: false }));
      newEntries.push({ time: fmtTime(), label, isCurrent: true });
      logsRef.current = newEntries;
      forceUpdate(n => n + 1);
    } else if (positionChanged && task.status === 'queued' && task.queuePosition != null) {
      prevQueuePositionRef.current = task.queuePosition;
      // Update label of current queued entry
      const entries = [...logsRef.current];
      const lastIdx = entries.length - 1;
      if (lastIdx >= 0 && entries[lastIdx].isCurrent) {
        entries[lastIdx] = {
          ...entries[lastIdx],
          label: `排队中（第 ${task.queuePosition + 1} 位）`,
        };
        logsRef.current = entries;
        forceUpdate(n => n + 1);
      }
    }
  }, [task.status, task.queuePosition]);

  const statusColor = DRAWER_STATUS_COLOR[task.status] || 'text-text-muted';
  const dotColor = DRAWER_DOT_COLOR[task.status] || 'bg-surface-3';

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">单条任务</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
            <span className={`text-[11px] ${statusColor}`}>{DRAWER_STATUS_LABEL[task.status]}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Full prompt */}
        <section>
          <p className="text-xs text-text-muted mb-1.5">提示词</p>
          <p className="text-[12px] text-text-secondary leading-relaxed break-words">
            {task.prompt || '无提示词'}
          </p>
        </section>

        <div className="h-px bg-border" />

        {/* Params */}
        <section>
          <p className="text-xs text-text-muted mb-1.5">参数</p>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-[11px] text-text-disabled">模型</span>
              <span className="text-[11px] text-text-secondary">{modelLabel(task.model)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-text-disabled">时长</span>
              <span className="text-[11px] text-text-secondary">{task.duration}s</span>
            </div>
          </div>
        </section>

        {/* Materials */}
        {task.materials?.length > 0 && (
          <>
            <div className="h-px bg-border" />
            <section>
              <p className="text-xs text-text-muted mb-1.5">素材</p>
              <div className="flex flex-wrap gap-2">
                {task.materials.map((m, i) => (
                  <button
                    key={i}
                    className="w-20 h-20 rounded-lg overflow-hidden border border-border bg-surface-2 flex-shrink-0 hover:border-brand transition-colors"
                    onClick={() => {
                      if (m.type === 'image') window.api.openFile(m.path);
                    }}
                    title={m.path}
                  >
                    {m.type === 'image'
                      ? <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center">
                          <Film size={16} className="text-text-disabled" />
                        </div>
                    }
                  </button>
                ))}
              </div>
            </section>
          </>
        )}

        <div className="h-px bg-border" />

        {/* Status log */}
        <section>
          <p className="text-xs text-text-muted mb-2">状态记录</p>
          <div className="space-y-1.5">
            {logsRef.current.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-text-disabled w-10 flex-shrink-0">{entry.time}</span>
                <span className={`text-[11px] ${entry.isCurrent ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
                  {entry.isCurrent ? '● ' : '  '}{entry.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

// ── Batch Task Drawer Content ─────────────────────────────────────────────────

function BatchDrawerContent({
  batchTasks,
  batchInfo,
  onClose,
}: {
  batchTasks: BatchTaskItem[];
  batchInfo?: BatchInfo | null;
  onClose: () => void;
}) {
  const total = batchTasks.length;
  const running = batchTasks.filter(t => t.status === 'generating' || t.status === 'submitted').length;
  const done = batchTasks.filter(t => t.status === 'completed' || t.status === 'downloaded').length;
  const failed = batchTasks.filter(t => t.status === 'failed').length;

  const isAllDone = done + failed === total;
  const statusLabel = isAllDone ? '已完成' : running > 0 ? '运行中' : '等待中';
  const statusColor = isAllDone ? 'text-success' : running > 0 ? 'text-brand' : 'text-text-muted';
  const dotColor = isAllDone ? 'bg-success' : running > 0 ? 'bg-brand animate-pulse' : 'bg-surface-3';

  const firstTask = batchTasks[0];
  const sharedMaterials = firstTask?.materials || [];

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">批量任务 · {total} 条</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
            <span className={`text-[11px] ${statusColor}`}>{statusLabel}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {/* Shared params */}
        <section>
          <p className="text-xs text-text-muted mb-1.5">共用参数</p>
          <div className="flex flex-col gap-1">
            {firstTask?.model && (
              <div className="flex justify-between">
                <span className="text-[11px] text-text-disabled">模型</span>
                <span className="text-[11px] text-text-secondary">{modelLabel(firstTask.model)}</span>
              </div>
            )}
            {firstTask?.duration && (
              <div className="flex justify-between">
                <span className="text-[11px] text-text-disabled">时长</span>
                <span className="text-[11px] text-text-secondary">{firstTask.duration}s</span>
              </div>
            )}
            {firstTask?.aspectRatio && (
              <div className="flex justify-between">
                <span className="text-[11px] text-text-disabled">比例</span>
                <span className="text-[11px] text-text-secondary">{firstTask.aspectRatio}</span>
              </div>
            )}
          </div>
          {sharedMaterials.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {sharedMaterials.map((m, i) => (
                <button
                  key={i}
                  className="w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface-2 flex-shrink-0 hover:border-brand transition-colors"
                  onClick={() => { if (m.type === 'image') window.api.openFile(m.path); }}
                  title={m.path}
                >
                  {m.type === 'image'
                    ? <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <Film size={14} className="text-text-disabled" />
                      </div>
                  }
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="h-px bg-border" />

        {/* All tasks */}
        <section>
          <p className="text-xs text-text-muted mb-2">全部任务</p>
          <div className="space-y-2">
            {batchTasks.map((t, idx) => {
              const tDot = DRAWER_DOT_COLOR[t.status] || 'bg-surface-3';
              const tColor = DRAWER_STATUS_COLOR[t.status] || 'text-text-muted';
              const tLabel = DRAWER_STATUS_LABEL[t.status] || t.status;
              return (
                <div key={t.id} className="flex items-start gap-2">
                  <span className="text-[10px] text-text-disabled w-5 flex-shrink-0 text-right pt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tDot}`} />
                    <span className={`text-[10px] ${tColor} w-10 flex-shrink-0`}>{tLabel}</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-snug break-words flex-1">
                    {t.prompt}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Batch name if available */}
        {(batchInfo?.name || batchInfo?.description) && (
          <>
            <div className="h-px bg-border" />
            <section>
              <p className="text-xs text-text-muted mb-1.5">批次名称</p>
              <p className="text-[12px] text-text-secondary">{batchInfo.name || batchInfo.description}</p>
            </section>
          </>
        )}
      </div>
    </>
  );
}

// ── QueueDetailDrawer ─────────────────────────────────────────────────────────

export function QueueDetailDrawer({
  open,
  onClose,
  task,
  batchTasks,
  batchInfo,
}: QueueDetailDrawerProps) {
  const isBatch = Boolean(batchTasks && batchTasks.length > 0);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-[360px] z-50 bg-surface-1 border-l border-border
          transition-transform duration-300 flex flex-col overflow-hidden
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {isBatch
          ? <BatchDrawerContent batchTasks={batchTasks!} batchInfo={batchInfo} onClose={onClose} />
          : task
            ? <SingleDrawerContent task={task} onClose={onClose} />
            : null
        }
      </div>
    </>
  );
}
