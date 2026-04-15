import { useEffect, useState } from 'react';
import { useStore } from './store';
import { ChatPanel } from './components/ChatPanel';
import { QueuePanel } from './components/QueuePanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { BatchTaskPanel } from './components/BatchTaskPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VideoModal } from './components/VideoModal';
import { Maximize2, Minimize2, PawPrint } from 'lucide-react';

export default function App() {
  const {
    appState,
    setAppState,
    setSettings, activePanel, setActivePanel,
    taskMode, batchTasks, previewUrl, setPreviewUrl,
  } = useStore();

  const [showBatchPanel, setShowBatchPanel] = useState(true);

  useEffect(() => {
    init();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+, → open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setActivePanel('settings');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivePanel]);

  // Listen for backend events
  useEffect(() => {
    const removeLogin = window.api.onLoginRequired(() => {
      useStore.getState().setGuidedStep('welcome');
      useStore.getState().setIsLoggedIn(false);
    });

    const removeLoginDetected = window.api.onLoginDetected(() => {
      const store = useStore.getState();
      store.setIsLoggedIn(true);
      store.setGuidedStep('logged-in-ready');
      store.addMessage({
        id: Date.now().toString() + '_login_ok',
        role: 'assistant',
        content: '✅ 登录成功！请描述你想生成的视频',
        timestamp: new Date(),
      });
    });

    const removeNotificationClick = window.api.onNotificationClick?.(({ taskId }) => {
      const store = useStore.getState();
      store.setActivePanel('results');
      store.setHighlightedTaskId(taskId);
    });

    const removeNotificationClickV2 = window.api.onNotificationClickV2?.(({ taskId, submitId }: { taskId: string; submitId: string }) => {
      console.log('[通知点击] taskId:', taskId, 'submitId:', submitId);
      const store = useStore.getState();
      store.setActivePanel('results');
      if (taskId) store.setHighlightedTaskId(taskId);
      // 如果有 submitId，也可以用它来定位任务
    });

    return () => {
      removeLogin();
      removeLoginDetected();
      removeNotificationClick?.();
      removeNotificationClickV2?.();
    };
  }, []);

  async function init() {
    try {
      const savedSettings = await window.api.getSettings();
      if (savedSettings) setSettings(savedSettings);
      setAppState('ready');
    } catch (err) {
      console.error('初始化失败:', err);
      setAppState('ready');
    }
  }

  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--color-background)] text-white">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-brand)] flex items-center justify-center mx-auto mb-5 shadow-[var(--shadow-brand-sm)] animate-glow">
            <PawPrint size={20} strokeWidth={2.2} className="text-white" />
          </div>
          <div className="relative w-6 h-6 mx-auto mb-3">
            <div className="absolute inset-0 rounded-full border-2 border-brand/30" />
            <div className="absolute inset-0 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-text-muted">正在启动...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[var(--color-background)] text-white">
        {/* Left sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            {activePanel === 'chat' && <ChatPanel />}
            {activePanel === 'queue' && <QueuePanel />}
            {activePanel === 'history' && <HistoryPanel />}
            {activePanel === 'settings' && <SettingsPanel />}
          </div>

          {/* Batch task panel (right) */}
          {taskMode === 'batch' && batchTasks.length > 0 && showBatchPanel && (
            <div className="w-80 border-l border-[var(--color-border)] shrink-0">
              <BatchTaskPanel />
            </div>
          )}
        </main>

        {/* Batch toggle button */}
        {taskMode === 'batch' && batchTasks.length > 0 && (
          <button
            onClick={() => setShowBatchPanel(!showBatchPanel)}
            className="fixed bottom-4 right-4 p-2 bg-[var(--color-brand)] text-white rounded-full shadow-[var(--shadow-lg)] hover:shadow-[var(--shadow-lg)] transition-all"
            title={showBatchPanel ? '隐藏任务面板' : '显示任务面板'}
          >
            {showBatchPanel ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        )}

        {/* Video preview modal */}
        <VideoModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      </div>
    </ErrorBoundary>
  );
}
