import { useState } from 'react';
import { FolderOpen, RefreshCw, Check, LogOut, BarChart3, TrendingUp, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { useStore } from '../store';

export function SettingsPanel() {
  const { settings, setSettings, addMessage, usage } = useStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const result = await window.api.saveSettings(settings);
      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectDir() {
    const { dir } = await window.api.selectDownloadDir();
    if (dir) setSettings({ downloadDir: dir });
  }

  async function handleRelogin() {
    addMessage({
      id: Date.now().toString(),
      role: 'system',
      content: '🔄 正在清除登录态...',
      timestamp: new Date(),
    });
    const result = await window.api.authLogout();
    if (result.success) {
      useStore.getState().setIsLoggedIn(false);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: '✅ 已清除登录态，下次使用时需要重新登录',
        timestamp: new Date(),
      });
    } else {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: `❌ 清除失败: ${result.error || '未知错误'}`,
        timestamp: new Date(),
        type: 'error',
      });
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-0">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle flex-shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-text-primary">设置</h1>
          <p className="text-[11px] text-text-muted">配置即梦助手</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-lg space-y-5">

          {/* Download Directory */}
          <section>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2.5">
              <FolderOpen size={14} className="text-brand" />
              下载目录
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.downloadDir}
                onChange={(e) => setSettings({ downloadDir: e.target.value })}
                className="flex-1 bg-surface-1 border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-muted focus-brand transition-colors"
              />
              <button
                onClick={handleSelectDir}
                className="px-3 rounded-md bg-surface-2 text-text-muted hover:text-text-primary text-xs transition-colors border border-border-subtle"
              >
                选择
              </button>
            </div>
          </section>

          {/* Auto Download Toggle */}
          <section className="flex items-center justify-between py-1">
            <div>
              <label className="text-sm font-medium text-text-primary">完成后自动下载</label>
              <p className="text-[10px] text-text-disabled mt-0.5">作品生成后自动下载到本地</p>
            </div>
            <button
              onClick={() => setSettings({ autoDownload: !settings.autoDownload })}
              className={`
                w-10 h-5.5 rounded-full transition-colors relative
                ${settings.autoDownload ? 'bg-brand' : 'bg-surface-3'}
              `}
            >
              <span
                className={`
                  absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white transition-transform shadow-sm
                  ${settings.autoDownload ? 'translate-x-[20px]' : 'translate-x-0.5'}
                `}
              />
            </button>
          </section>

          <div className="h-px bg-border-subtle" />

          {/* Re-login */}
          <section>
            <label className="text-sm font-medium text-text-primary mb-2.5 block">即梦账号</label>
            <button
              onClick={handleRelogin}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm transition-colors border border-border-subtle hover:border-border"
            >
              <LogOut size={15} />
              退出登录
            </button>
            <p className="text-[10px] text-text-disabled mt-1.5">
              清除本地登录态，下次使用时需要重新登录
            </p>
          </section>

          <div className="h-px bg-border-subtle" />

          {/* About */}
          <section>
            <h3 className="text-sm font-medium text-text-primary mb-2">关于</h3>
            <div className="text-xs text-text-muted space-y-1.5">
              <p className="font-mono">VidClaw <span className="text-text-disabled">v0.1.1</span></p>
              <p>技术栈：Electron + 即梦 CLI + DeepSeek</p>
            </div>
          </section>

          <div className="h-px bg-border-subtle" />

          {/* Usage Statistics */}
          <section>
            <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
              <BarChart3 size={14} className="text-brand" />
              用量统计
            </label>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-2 rounded-md p-2.5 border border-border-subtle text-center">
                <p className="text-base font-semibold text-text-primary font-mono">{usage.totalTasks}</p>
                <p className="text-[10px] text-text-muted mt-0.5">总任务</p>
              </div>
              <div className="bg-surface-2 rounded-md p-2.5 border border-border-subtle text-center">
                <p className="text-base font-semibold font-mono text-success">{usage.completedTasks}</p>
                <p className="text-[10px] text-text-muted mt-0.5">已完成</p>
              </div>
              <div className="bg-surface-2 rounded-md p-2.5 border border-border-subtle text-center">
                <p className="text-base font-semibold font-mono text-error">{usage.failedTasks}</p>
                <p className="text-[10px] text-text-muted mt-0.5">失败</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-text-disabled">
              <Calendar size={10} />
              <span>今日: {usage.todayTasks} 个任务</span>
              <span>·</span>
              <TrendingUp size={10} />
              <span>成功率: {usage.totalTasks > 0 ? Math.round((usage.completedTasks / usage.totalTasks) * 100) : 0}%</span>
            </div>
          </section>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors
              ${saved
                ? 'bg-success text-white'
                : 'bg-brand text-white hover:bg-brand-dark'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {saving ? (
              <><RefreshCw size={15} className="animate-spin" /> 保存中...</>
            ) : saved ? (
              <><Check size={15} /> 已保存</>
            ) : (
              '保存设置'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
