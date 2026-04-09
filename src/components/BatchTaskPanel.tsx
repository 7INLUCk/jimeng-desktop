import { Play, Pause, Trash2, Edit3, Download, FolderOpen, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useStore, type BatchTaskItem, type QueueTask } from '../store';

// ── Task Status Badge ──
const statusStyles: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'var(--color-surface-3)', text: 'var(--color-text-secondary)' },
  submitted: { bg: 'oklch(0.65 0.25 270 / 0.2)', text: 'oklch(0.65 0.25 270)' },
  generating: { bg: 'oklch(0.75 0.16 75 / 0.2)', text: 'oklch(0.75 0.16 75)' },
  completed: { bg: 'oklch(0.7 0.15 145 / 0.2)', text: 'oklch(0.7 0.15 145)' },
  downloaded: { bg: 'var(--color-brand-subtle)', text: 'var(--color-brand)' },
  failed: { bg: 'oklch(0.6 0.2 25 / 0.2)', text: 'oklch(0.6 0.2 25)' },
};

function StatusBadge({ status }: { status: string }) {
  const style = statusStyles[status] || statusStyles.pending;

  const statusText: Record<string, string> = {
    pending: '等待中',
    submitted: '已提交',
    generating: '生成中',
    completed: '已完成',
    downloaded: '已下载',
    failed: '失败',
  }; 

  const IconComponent = {
    pending: Clock,
    submitted: Loader2,
    generating: Loader2,
    completed: CheckCircle,
    downloaded: Download,
    failed: XCircle,
  }[status] || Clock;

  const iconClass = status === 'submitted' || status === 'generating' ? 'animate-spin' : '';

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5"
      style={{
        background: style.bg,
        color: style.text,
        borderRadius: 'var(--radius-lg)',
        fontSize: '10px',
        fontWeight: 500,
      }}
    >
      <IconComponent size={12} className={iconClass} />
      {statusText[status] || status}
    </span>
  );
}

// ── Task Item Card ──
function TaskItemCard({
  task,
  index,
  onEdit,
  onDelete,
  onOpenFolder,
}: {
  task: BatchTaskItem;
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onOpenFolder?: () => void;
}) {
  const isEditable = task.status === 'pending';
  const isDownloaded = task.status === 'downloaded';

  return (
    <div
      className="transition-colors"
      style={{
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {/* 左侧:序号 + 状态 */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="flex items-center justify-center"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-brand-subtle)',
              color: 'var(--color-brand)',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {index}
          </span>
          <StatusBadge status={task.status} />
        </div>

        {/* 右侧:操作按钮 */}
        <div className="flex items-center gap-1">
          {isEditable && onEdit && (
            <button
              onClick={onEdit}
              className="transition-colors"
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-3)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
              title="编辑任务"
            >
              <Edit3 size={14} />
            </button>
          )}
          {isEditable && onDelete && (
            <button
              onClick={onDelete}
              className="transition-colors"
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'oklch(0.6 0.2 25 / 0.2)';
                e.currentTarget.style.color = 'oklch(0.6 0.2 25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
              title="删除任务"
            >
              <Trash2 size={14} />
            </button>
          )}
          {isDownloaded && onOpenFolder && (
            <button
              onClick={onOpenFolder}
              className="transition-colors"
              style={{
                padding: '6px',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-3)';
                e.currentTarget.style.color = 'var(--color-brand)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--color-text-muted)';
              }}
              title="打开文件位置"
            >
              <FolderOpen size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 提示词 */}
      <p
        className="mt-2 line-clamp-2"
        style={{
          fontSize: '12px',
          color: 'var(--color-text-primary)',
        }}
      >{task.prompt}</p>

      {/* 理由/测试目的 */}
      {task.reason && (
        <p
          className="mt-1"
          style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
          }}
        >💡 {task.reason}</p>
      )}

      {/* 参数 */}
      <div
        className="flex items-center gap-2 mt-2"
        style={{
          fontSize: '10px',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>{task.duration}s</span>
        <span>·</span>
        <span>{task.aspectRatio}</span>
        {task.materials?.length > 0 && (
          <>
            <span>·</span>
            <span>{task.materials.length} 素材</span>
          </>
        )}
      </div>

      {/* 错误信息 */}
      {task.error && (
        <p
          className="mt-1"
          style={{
            fontSize: '10px',
            color: 'oklch(0.6 0.2 25)',
          }}
        >❌ {task.error}</p>
      )}

      {/* 下载路径 */}
      {task.outputFile && (
        <p
          className="mt-1 truncate"
          style={{
            fontSize: '10px',
            color: 'var(--color-brand)',
          }}
          title={task.outputFile}
        >
          📁 {task.outputFile.split('/').pop()}
        </p>
      )}
    </div>
  );
}

// ── Batch Task Panel ──
export function BatchTaskPanel() {
  const { batchTasks, batchInfo, taskMode, setBatchTasks, setBatchInfo } = useStore();

  if (taskMode !== 'batch' || batchTasks.length === 0) {
    return null;
  }

  // 分类任务
  const runningTasks = batchTasks.filter(t => ['submitted', 'generating'].includes(t.status));
  const pendingTasks = batchTasks.filter(t => t.status === 'pending');
  const completedTasks = batchTasks.filter(t => ['completed', 'downloaded'].includes(t.status));
  const failedTasks = batchTasks.filter(t => t.status === 'failed');

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
      }}
    >
      {/* Header */}
      <div
        className="p-4 shrink-0"
        style={{
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              className="flex items-center gap-2"
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              <span style={{ fontSize: '18px' }}>📋</span>
              {batchInfo?.name || '批量任务'}
            </h2>
            {batchInfo?.description && (
              <p
                className="mt-0.5"
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                }}
              >{batchInfo.description}</p>
            )}
          </div>
          <div className="text-right">
            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {batchInfo?.completedTasks || 0} / {batchInfo?.totalTasks || batchTasks.length}
            </p>
            <div
              className="mt-1 overflow-hidden"
              style={{
                width: '96px',
                height: '6px',
                background: 'var(--color-surface-3)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${((batchInfo?.completedTasks || 0) / (batchInfo?.totalTasks || 1)) * 100}%`,
                  background: 'var(--color-brand)',
                  borderRadius: 'var(--radius-lg)',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Task Lists */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Running */}
        {runningTasks.length > 0 && (
          <section>
            <h3
              className="mb-2 flex items-center gap-1"
              style={{
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <Loader2 size={10} className="animate-spin" style={{ color: 'oklch(0.75 0.16 75)' }} />
              正在执行 ({runningTasks.length})
            </h3>
            <div className="space-y-2">
              {runningTasks.map((task, i) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                />
              ))}
            </div>
          </section>
        )}

        {/* Pending */}
        {pendingTasks.length > 0 && (
          <section>
            <h3
              className="mb-2 flex items-center gap-1"
              style={{
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <Clock size={10} />
              等待中 ({pendingTasks.length})
            </h3>
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                  onEdit={() => {
                    // TODO: 打开编辑弹窗
                    console.log('Edit task', task.id);
                  }}
                  onDelete={() => {
                    window.api.deleteBatchTask(task.id);
                    // 刷新任务列表
                    window.api.getBatchStatus().then((result) => {
                      if (result.success && result.tasks) {
                        useStore.getState().setBatchTasks(result.tasks);
                      }
                    });
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Completed */}
        {completedTasks.length > 0 && (
          <section>
            <h3
              className="mb-2 flex items-center gap-1"
              style={{
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <CheckCircle size={10} style={{ color: 'oklch(0.7 0.15 145)' }} />
              已完成 ({completedTasks.length})
            </h3>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                  onOpenFolder={() => {
                    if (task.outputFile) {
                      window.api.openDownloadDir();
                    }
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Failed */}
        {failedTasks.length > 0 && (
          <section>
            <h3
              className="mb-2 flex items-center gap-1"
              style={{
                fontSize: '10px',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <XCircle size={10} style={{ color: 'oklch(0.6 0.2 25)' }} />
              失败 ({failedTasks.length})
            </h3>
            <div className="space-y-2">
              {failedTasks.map((task) => (
                <TaskItemCard
                  key={task.id}
                  task={task}
                  index={batchTasks.indexOf(task) + 1}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer Actions */}
      <div
        className="p-4 shrink-0 space-y-2"
        style={{
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <button
          onClick={() => window.api.openDownloadDir()}
          className="w-full flex items-center justify-center gap-2 transition-colors"
          style={{
            padding: '8px 16px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-2)'}
        >
          <FolderOpen size={14} />
          打开下载目录
        </button>
        {batchInfo?.status === 'running' && (
          <button
            onClick={() => window.api.stopBatch()}
            className="w-full flex items-center justify-center gap-2 transition-colors"
            style={{
              padding: '8px 16px',
              background: 'oklch(0.6 0.2 25 / 0.2)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 500,
              color: 'oklch(0.6 0.2 25)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'oklch(0.6 0.2 25 / 0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'oklch(0.6 0.2 25 / 0.2)'}
          >
            <Pause size={14} />
            停止批量任务
          </button>
        )}
        {pendingTasks.length > 0 && batchInfo?.status !== 'running' && (
          <button
            onClick={() => window.api.startBatch()}
            className="w-full flex items-center justify-center gap-2 transition-colors"
            style={{
              padding: '8px 16px',
              background: 'var(--color-brand)',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              fontWeight: 500,
              color: 'white',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'oklch(0.55 0.25 270)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-brand)'}
          >
            <Play size={14} />
            开始执行
          </button>
        )}
      </div>
    </div>
  );
}

// ── Mini Status Bar (在对话界面顶部显示) ──
export function BatchStatusMini() {
  const { batchTasks, batchInfo, taskMode, activePanel, setActivePanel } = useStore();

  if (taskMode !== 'batch' || !batchInfo) return null;

  const completed = batchTasks.filter(t => ['completed', 'downloaded'].includes(t.status)).length;
  const total = batchTasks.length;
  const running = batchTasks.filter(t => ['submitted', 'generating'].includes(t.status)).length;

  return (
    <div
      className="px-4 py-2 flex items-center justify-between"
      style={{
        background: 'var(--color-surface-2)',
        borderBottom: '1px solid var(--color-border)',
        fontSize: '12px',
      }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: 'var(--color-text-secondary)' }}>📦 {batchInfo.name}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>|</span>
        <span style={{ color: 'var(--color-brand)' }}>{completed}/{total} 完成</span>
        {running > 0 && (
          <>
            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
            <span className="flex items-center gap-1" style={{ color: 'oklch(0.75 0.16 75)' }}>
              <Loader2 size={10} className="animate-spin" />
              {running} 个执行中
            </span>
          </>
        )}
      </div>
      <button
        onClick={() => setActivePanel('results')}
        style={{
          color: 'var(--color-brand)',
          fontSize: '12px',
        }}
        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
      >
        查看详情 →
      </button>
    </div>
  );
}