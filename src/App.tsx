import { useEffect, useState } from 'react';
import { useStore } from './store';
import { ChatPanel } from './components/ChatPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { Sidebar } from './components/Sidebar';
import { BatchTaskPanel, BatchStatusMini } from './components/BatchTaskPanel';
import { Maximize2, Minimize2, PawPrint } from 'lucide-react';

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
      // Seedance 模式任务准备（带素材 @引用）
      prepareTaskForSeedance: (input: string, materials: { images?: any[]; videos?: any[]; audios?: any[] }) => Promise<{ success: boolean; task?: any; materials?: any; error?: string }>;
      // 批量任务准备
      prepareBatchTasks: (input: string) => Promise<{ success: boolean; batchName?: string; description?: string; tasks?: any[]; questions?: string[]; error?: string }>;
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
      onProgress: (callback: (data: any) => void) => () => void;
      onComplete: (callback: (data: any) => void) => () => void;
      onLoginRequired: (callback: () => void) => () => void;
      onLoginDetected: (callback: () => void) => () => void;
      // Phase 1-3: 结构化自动化 API
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

      // 批量任务 API
      createBatch: (batch: any, tasks: any[]) => Promise<{ success: boolean; batchId?: string; totalTasks?: number; error?: string }>;
      startBatch: () => Promise<{ success: boolean; error?: string }>;
      stopBatch: () => Promise<{ success: boolean; error?: string }>;
      getBatchStatus: () => Promise<{ success: boolean; batch?: any; tasks?: any[]; statusCounts?: any; running?: boolean; error?: string }>;
      updateBatchTask: (taskId: string, updates: any) => Promise<{ success: boolean; task?: any; error?: string }>;
      deleteBatchTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export default function App() {
  const {
    appState,
    setAppState,
    setSettings, setResults, activePanel,
    taskMode, batchTasks,
  } = useStore();

  // 批量任务面板显示状态
  const [showBatchPanel, setShowBatchPanel] = useState(true);

  useEffect(() => {
    init();
  }, []);

  // 监听后端事件
  useEffect(() => {
    const removeLogin = window.api.onLoginRequired(() => {
      // 登录过期等情况，回到 welcome 步骤
      useStore.getState().setGuidedStep('welcome');
      useStore.getState().setIsLoggedIn(false);
    });

    const removeLoginDetected = window.api.onLoginDetected(() => {
      // 后端检测到登录成功
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

    return () => {
      removeLogin();
      removeLoginDetected();
    };
  }, []);

  async function init() {
    try {
      // 加载设置
      const savedSettings = await window.api.getSettings();
      if (savedSettings) setSettings(savedSettings);

      // 加载已有结果
      const { results } = await window.api.getResults();
      if (results?.length) setResults(results);

      // 直接进入就绪状态，不自动开浏览器
      setAppState('ready');
    } catch (err) {
      console.error('初始化失败:', err);
      setAppState('ready');
    }
  }

  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-0 text-white">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center mx-auto mb-5 shadow-[var(--shadow-brand-lg)] animate-glow">
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
    <div className="flex h-screen bg-surface-0 text-white">
      {/* 左侧边栏 */}
      <Sidebar />

      {/* 主内容区 */}
      <main className="flex-1 flex min-w-0">
        {/* 对话/结果/设置面板 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 批量任务状态栏 */}
          <BatchStatusMini />
          {activePanel === 'chat' && <ChatPanel />}
          {activePanel === 'results' && <ResultsPanel />}
          {activePanel === 'settings' && <SettingsPanel />}
        </div>

        {/* 批量任务面板（右侧） */}
        {taskMode === 'batch' && batchTasks.length > 0 && showBatchPanel && (
          <div className="w-80 border-l border-border shrink-0">
            <BatchTaskPanel />
          </div>
        )}
      </main>

      {/* 批量任务面板切换按钮 */}
      {taskMode === 'batch' && batchTasks.length > 0 && (
        <button
          onClick={() => setShowBatchPanel(!showBatchPanel)}
          className="fixed bottom-4 right-4 p-2 bg-brand text-white rounded-full shadow-lg hover:shadow-xl transition-all"
          title={showBatchPanel ? '隐藏任务面板' : '显示任务面板'}
        >
          {showBatchPanel ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      )}
    </div>
  );
}
