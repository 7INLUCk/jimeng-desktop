import { useEffect, useState } from 'react';
import { useStore } from './store';
import { initLocalFileServer } from './utils/localFile';
import { ChatPanel } from './components/ChatPanel';
import { QueuePanel } from './components/QueuePanel';
import { HistoryPanel } from './components/HistoryPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { SkillsPanel } from './components/SkillsPanel';
import { SubscriptionPanel } from './components/SubscriptionPanel';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { WorksPanel } from './components/WorksPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VideoModal } from './components/VideoModal';
import { PawPrint, Zap } from 'lucide-react';

declare global {
  interface Window {
    api: {
      launchBrowser: () => Promise<{ success: boolean; error?: string }>;
      checkLogin: () => Promise<{ loggedIn: boolean }>;
      clickLogin: () => Promise<{ success: boolean }>;
      relaunchBrowser: () => Promise<{ success: boolean; error?: string }>;
      openJimeng: () => Promise<{ success: boolean; error?: string }>;
      submitTask: (input: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      submitTaskWithFiles: (input: string, filePaths: string[]) => Promise<{ success: boolean; message?: string; error?: string }>;
      prepareTask: (input: string) => Promise<{ success: boolean; task?: any; error?: string }>;
      executeTask: (task: any) => Promise<{ success: boolean; message?: string; error?: string }>;
      prepareTaskForSeedance: (input: string, materials: { images?: any[]; videos?: any[]; audios?: any[] }) => Promise<{ success: boolean; task?: any; materials?: any; error?: string }>;
      prepareBatchTasks: (input: string, materials?: { images: any[]; videos: any[]; audios: any[] }, defaults?: { model?: string; duration?: number; aspectRatio?: string }) => Promise<{ success: boolean; batchName?: string; description?: string; tasks?: any[]; questions?: string[]; error?: string }>;
      downloadTask: (item: any) => Promise<{ success: boolean; filepath?: string; error?: string }>;
      downloadAll: () => Promise<{ results: any[] }>;
      getResults: () => Promise<{ results: any[] }>;
      enqueueTask: (task: any) => Promise<{ success: boolean; queueStatus?: any }>;
      processQueue: () => Promise<{ success: boolean }>;
      getQueueStatus: () => Promise<{ queueStatus: any }>;
      selectFiles: () => Promise<{ files: string[] }>;
      selectDownloadDir: () => Promise<{ dir: string }>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<{ success: boolean; settings?: any }>;
      getStatus: () => Promise<{ browserReady: boolean; isLoggedIn: boolean | null; version: string; resultsCount: number; queueStatus: any }>;
      openDownloadDir: () => Promise<{ success: boolean; error?: string }>;
      openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      getFileStat: (filePath: string) => Promise<{ size: number }>;
      getFileServerPort: () => Promise<number>;
      onProgress: (callback: (data: any) => void) => () => void;
      onComplete: (callback: (data: any) => void) => () => void;
      onLoginRequired: (callback: () => void) => () => void;
      onLoginDetected: (callback: () => void) => () => void;
      onNotificationClick: (callback: (data: { taskId: string }) => void) => () => void;
      onNotificationClickV2: (callback: (data: { taskId: string; submitId: string }) => void) => () => void;
      navigateToGenerate: () => Promise<{ success: boolean; error?: string }>;
      switchToSeedanceMode: () => Promise<{ success: boolean; mode?: string; error?: string }>;
      selectModel: (model: string) => Promise<{ success: boolean; model?: string; label?: string; error?: string }>;
      setDuration: (seconds: number) => Promise<{ success: boolean; duration?: number; error?: string }>;
      setAspectRatio: (ratio: string) => Promise<{ success: boolean; ratio?: string; error?: string }>;
      uploadMaterials: (materials: Array<{ path: string; type: 'image' | 'video' }>) => Promise<{ success: boolean; results: Array<{ path: string; type: string; success: boolean; storeUri?: string; vid?: string; error?: string }> }>;
      submitStructured: (params: { prompt: string; materials?: any[]; metaList?: any[]; model?: string; duration?: number; aspectRatio?: string }) => Promise<{ success: boolean; taskId?: string; uploadResults?: any[]; message?: string; error?: string }>;
      runStructuredTask: (params: { prompt: string; materials?: any[]; metaList?: any[]; model?: string; duration?: number; aspectRatio?: string }) => Promise<{ success: boolean; taskId?: string; uploadResults?: any[]; message?: string; error?: string }>;
      getModels: () => Promise<{ models: Record<string, { key: string; label: string; benefit: string }>; aspectRatios: string[] }>;
      initMode: () => Promise<{ success: boolean; error?: string }>;
      createBatch: (batch: any, tasks: any[]) => Promise<{ success: boolean; batchId?: string; totalTasks?: number; error?: string }>;
      startBatch: () => Promise<{ success: boolean; error?: string }>;
      stopBatch: () => Promise<{ success: boolean; error?: string }>;
      getBatchStatus: () => Promise<{ success: boolean; batch?: any; tasks?: any[]; statusCounts?: any; running?: boolean; error?: string }>;
      updateBatchTask: (taskId: string, updates: any) => Promise<{ success: boolean; task?: any; error?: string }>;
      deleteBatchTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
      sendTaskNotify: (task: { id: string; prompt: string }) => Promise<void>;
      checkCredits: () => Promise<{ success: boolean; isLoggedIn?: boolean; credits?: number; error?: string }>;
      authLogin: () => Promise<{ success: boolean; qrPath?: string; message?: string; error?: string }>;
      authLogout: () => Promise<{ success: boolean; error?: string }>;
      // ── Internal email auth ──
      emailLogin: (email: string) => Promise<{ success: boolean; isInternal?: boolean; error?: string }>;
      // ── Kling O1 via Coze ──
      klingGenerate: (params: {
        imagePaths: string[];
        prompt: string;
        duration: number;
        aspectRatio: string;
        submitId?: string;
      }) => Promise<{ success: boolean; videoUrl?: string; localPath?: string; submitId?: string; error?: string }>;
    };
  }
}

export default function App() {
  const {
    appState,
    setAppState,
    setSettings, activePanel, setActivePanel,
    previewUrl, setPreviewUrl,
    auth, credits,
  } = useStore();


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
      store.setActivePanel('works');
      store.setHighlightedTaskId(taskId);
    });

    const removeNotificationClickV2 = window.api.onNotificationClickV2?.(({ taskId, submitId }: { taskId: string; submitId: string }) => {
      console.log('[通知点击] taskId:', taskId, 'submitId:', submitId);
      const store = useStore.getState();
      store.setActivePanel('works');
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
      await initLocalFileServer();
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
        {/* Auth gate — shown when not logged in */}
        {!auth && <AuthModal />}

        {/* Low credits banner */}
        {auth && credits.balance < 50 && credits.balance >= 0 && activePanel !== 'subscription' && (
          <div className="fixed top-0 left-14 right-0 z-50 flex items-center justify-between px-4 py-1.5 text-xs"
            style={{ background: 'oklch(0.45 0.2 25 / 0.95)', backdropFilter: 'blur(4px)' }}>
            <div className="flex items-center gap-2">
              <Zap size={11} className="text-white/80" />
              <span className="text-white/90">积分余额不足 50，可灵 O1 功能受限</span>
            </div>
            <button
              onClick={() => setActivePanel('subscription')}
              className="text-white underline underline-offset-2 hover:text-white/80 transition-colors"
            >
              充值
            </button>
          </div>
        )}
        {/* Left sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col min-w-0">
            {activePanel === 'chat' && <ChatPanel />}
            {activePanel === 'works' && <WorksPanel />}
            {activePanel === 'queue' && <QueuePanel />}
            {activePanel === 'history' && <HistoryPanel />}
            {activePanel === 'skills' && <SkillsPanel />}
            {activePanel === 'settings' && <SettingsPanel />}
            {activePanel === 'subscription' && <SubscriptionPanel />}
          </div>
        </main>

        {/* Video preview modal */}
        <VideoModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
      </div>
    </ErrorBoundary>
  );
}
