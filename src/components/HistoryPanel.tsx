import { useState, useMemo, useCallback } from 'react';
import {
  Clock, Search, Download, Trash2, Play, Copy, Film, Image as ImageIcon,
  ChevronDown, ChevronRight, FolderOpen
} from 'lucide-react';
import { useStore, type HistoryItem } from '../store';
import { localFileUrlSync } from '../utils/localFile';
import { getOpenableLocalPath, isRemoteHttpUrl } from '../utils/filePath';

/** 将本地绝对路径转成 file server URL，远程 URL 原样返回 */
function toPlayableUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('/') || /^[A-Za-z]:\\/.test(url)) {
    return localFileUrlSync(url);
  }
  return url;
}

// ── Date grouping helpers ──
function getDateGroup(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;

  if (timestamp >= todayStart) return '今天';
  if (timestamp >= yesterdayStart) return '昨天';
  if (timestamp >= weekStart) return '本周';
  return '更早';
}

function groupByDate(items: HistoryItem[]): Array<{ label: string; items: HistoryItem[] }> {
  const groups: Record<string, HistoryItem[]> = {};
  for (const item of items) {
    const label = getDateGroup(item.createdAt);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }
  const order = ['今天', '昨天', '本周', '更早'];
  return order.filter(l => groups[l]).map(l => ({ label: l, items: groups[l] }));
}

// ── History Card ──
function HistoryCard({ item, onPreview }: { item: HistoryItem; onPreview: (url: string) => void }) {
  const { removeHistory, updateHistory, updateTask } = useStore();
  const openablePath = getOpenableLocalPath(item.localPath, item.resultUrl);
  const canPreview = Boolean(item.resultUrl);
  const canDownload = Boolean(item.submitId || openablePath || isRemoteHttpUrl(item.resultUrl));

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(item.prompt);
  }, [item.prompt]);

  const handleDownload = useCallback(() => {
    if (openablePath) {
      window.api.openFile(openablePath);
      return;
    }
    const downloadArgs = item.submitId
      ? { submitId: item.submitId, prompt: item.prompt, model: item.model, duration: item.duration }
      : isRemoteHttpUrl(item.resultUrl)
        ? { url: item.resultUrl, prompt: item.prompt, model: item.model, duration: item.duration }
        : null;
    if (!downloadArgs) return;
    void window.api.downloadTask(downloadArgs).then((result) => {
      if (result.success && result.filePath) {
        updateHistory(item.id, {
          localPath: result.filePath,
          resultUrl: result.filePath,
          status: 'downloaded',
        });
        const matchedTask = useStore.getState().tasks.find(t =>
          t.submitId === item.submitId ||
          (item.resultUrl && t.resultUrl === item.resultUrl)
        );
        if (matchedTask) {
          updateTask(matchedTask.id, {
            filePath: result.filePath,
            localPath: result.filePath,
            resultUrl: result.filePath,
            downloaded: true,
            status: 'downloaded',
          });
        }
      }
    });
  }, [item, openablePath, updateHistory, updateTask]);

  return (
    <div className="group bg-surface-1 border border-border-subtle rounded-md overflow-hidden hover:border-border transition-colors">
      {/* Thumbnail */}
      <div className="aspect-video bg-surface-2 relative overflow-hidden">
        {item.thumbnailUrl ? (
          <img
            src={toPlayableUrl(item.thumbnailUrl)}
            alt={item.prompt.slice(0, 20)}
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
          {item.duration}s
        </div>

        {/* Status badge */}
        {item.status === 'downloaded' && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-success/80 backdrop-blur-sm text-[10px] text-white">
            ✅ 已下载
          </div>
        )}
        {item.status === 'failed' && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-error/80 backdrop-blur-sm text-[10px] text-white">
            失败
          </div>
        )}

        {/* Action overlay */}
        <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          {canPreview && (
            <button
              onClick={() => onPreview(toPlayableUrl(item.resultUrl))}
              className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm hover:bg-brand text-white transition-colors"
              title="预览"
            >
              <Play size={13} />
            </button>
          )}
          {canDownload && (
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm hover:bg-brand text-white transition-colors"
              title="下载"
            >
              <Download size={13} />
            </button>
          )}
          {openablePath && (
            <button
              onClick={() => window.api.openFile(openablePath)}
              className="p-1.5 rounded-md bg-black/60 backdrop-blur-sm hover:bg-brand text-white transition-colors"
              title="打开文件"
            >
              <FolderOpen size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-[11px] text-text-primary line-clamp-2 leading-relaxed" title={item.prompt}>
          {item.prompt || '无提示词'}
        </p>
        <div className="flex items-center justify-between mt-1">
          <p className="text-[10px] text-text-disabled font-mono">
            {new Date(item.createdAt).toLocaleString('zh-CN', {
              month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              className="p-0.5 text-text-disabled hover:text-brand transition-colors"
              title="复制提示词"
            >
              <Copy size={10} />
            </button>
            <button
              onClick={() => removeHistory(item.id)}
              className="p-0.5 text-text-disabled hover:text-error transition-colors"
              title="删除"
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main HistoryPanel ──
export function HistoryPanel() {
  const { history, setPreviewUrl } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'completed' | 'failed'>('all');

  const filteredHistory = useMemo(() => {
    let items = history;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(h => h.prompt.toLowerCase().includes(q));
    }
    if (filterType === 'completed') {
      items = items.filter(h => h.status === 'completed' || h.status === 'downloaded');
    } else if (filterType === 'failed') {
      items = items.filter(h => h.status === 'failed');
    }
    return items;
  }, [history, searchQuery, filterType]);

  const grouped = useMemo(() => groupByDate(filteredHistory), [filteredHistory]);

  const handlePreview = useCallback((url: string) => {
    setPreviewUrl(url);
  }, [setPreviewUrl]);

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Clock size={16} className="text-brand" />
          <h1 className="text-sm font-semibold text-text-primary">作品历史</h1>
          <span className="text-[10px] text-text-muted bg-surface-3 px-1.5 py-0.5 rounded-full">
            {history.length}
          </span>
        </div>
      </header>

      {/* Tab Filter */}
      <div className="px-4 py-1.5 border-b border-border-subtle flex-shrink-0">
        <div className="flex gap-1">
          {[
            { key: 'all', label: '全部' },
            { key: 'completed', label: '已完成' },
            { key: 'failed', label: '失败' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key as any)}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                filterType === tab.key
                  ? 'bg-brand text-white'
                  : 'bg-surface-2 text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索作品..."
            className="w-full bg-surface-1 border border-border-subtle rounded-lg pl-9 pr-3 py-2 text-xs text-text-primary placeholder-text-muted focus-brand transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-md bg-surface-2 flex items-center justify-center mb-3">
              <Clock size={28} className="text-text-disabled" />
            </div>
            <p className="text-sm font-medium text-text-secondary mb-0.5">暂无历史作品</p>
            <p className="text-[11px] text-text-muted">生成的视频会自动保存在这里</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.label}>
                <h3 className="text-[11px] font-medium text-text-muted mb-3 flex items-center gap-1.5">
                  <span>{group.label}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-surface-3 text-[10px]">
                    {group.items.length}
                  </span>
                </h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                  {group.items.map((item) => (
                    <HistoryCard key={item.id} item={item} onPreview={handlePreview} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
