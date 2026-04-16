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
      downloadTask: (item: any) => Promise<{ success: boolean; filePath?: string; error?: string }>;
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

  // Global task progress listener — registered at App level so it survives panel switches
  useEffect(() => {
    const removeProgress = window.api.onProgress((data: any) => {
      const store = useStore.getState();

      if (data.event === 'queued' && data.data?.submitId) {
        const found = store.tasks.find((t: any) => t.submitId === data.data.submitId);
        if (found) {
          const { queuePosition, queueLength } = data.data;
          if (found.status !== 'queued' || found.queuePosition !== queuePosition || found.queueLength !== queueLength) {
            store.updateTask(found.id, { status: 'queued', queuePosition, queueLength, nextPollAt: data.data.nextPollAt });
          }
        }
        return;
      }

      if (data.event === 'kling-progress' && data.data?.submitId) {
        const nextStatus = data.data.stage === 'queued' ? 'queued' : 'generating';
        // Check batchTasks first (Kling O1 batch path)
        const batchTasks = store.batchTasks;
        const batchIdx = batchTasks.findIndex((bt: any) => bt.submitId === data.data.submitId);
        if (batchIdx !== -1) {
          store.setBatchTasks(batchTasks.map((bt: any, i: number) =>
            i === batchIdx
              ? { ...bt, status: nextStatus, queueStatus: data.data.stage === 'queued' ? 'Queuing' : 'Generating', queuePosition: data.data.queuePosition }
              : bt
          ));
          return;
        }
        const found = store.tasks.find((t: any) => t.submitId === data.data.submitId);
        if (found && (found.status !== nextStatus || found.progress !== data.data.progress || found.statusMessage !== data.data.message)) {
          store.updateTask(found.id, { status: nextStatus, progress: data.data.progress, statusMessage: data.data.message, queuePosition: undefined, nextPollAt: undefined });
        }
        return;
      }

      if (data.event === 'progress' && data.data?.submitId) {
        const found = store.tasks.find((t: any) => t.submitId === data.data.submitId);
        if (found) store.updateTask(found.id, { status: 'generating', progress: data.data.progress ?? 50 });
        return;
      }

      if (data.event === 'result') {
        // Check batchTasks first (Kling O1 batch path)
        const batchTasksOnResult = store.batchTasks;
        const batchIdxOnResult = batchTasksOnResult.findIndex((bt: any) => bt.submitId === data.data?.submitId);
        if (batchIdxOnResult !== -1) {
          const isDownloaded = Boolean(data.data.filePath);
          const updatedBatch = batchTasksOnResult.map((bt: any, i: number) =>
            i === batchIdxOnResult
              ? { ...bt, status: isDownloaded ? 'downloaded' as const : 'completed' as const, outputFile: data.data.filePath || data.data.resultUrl }
              : bt
          );
          store.setBatchTasks(updatedBatch);
          const batchInfoOnResult = store.batchInfo;
          const succeededCount = updatedBatch.filter((bt: any) => bt.status === 'completed' || bt.status === 'downloaded').length;
          if (batchInfoOnResult) store.setBatchInfo({ ...batchInfoOnResult, completedTasks: succeededCount });
          const allDone = updatedBatch.every((bt: any) => ['completed', 'downloaded', 'failed'].includes(bt.status));
          if (allDone) {
            const failedCount = updatedBatch.filter((bt: any) => bt.status === 'failed').length;
            const total = updatedBatch.length;
            store.addMessage({ id: Date.now().toString() + '_kbc', role: 'assistant', content: `📦 可灵批量任务完成!\n✅ ${succeededCount} 成功 / ❌ ${failedCount} 失败 / 共 ${total} 个任务`, timestamp: new Date() });
            if (batchInfoOnResult && updatedBatch.length > 0) {
              const sharedMat = updatedBatch[0]?.materials ?? [];
              store.addBatchHistory({
                id: batchInfoOnResult.id || ('batch_hist_' + Date.now()),
                name: batchInfoOnResult.name || '可灵 O1 批量任务',
                description: batchInfoOnResult.description || '',
                model: updatedBatch[0]?.model ?? 'kling-o1',
                duration: updatedBatch[0]?.duration ?? 5,
                aspectRatio: updatedBatch[0]?.aspectRatio ?? '9:16',
                sharedMaterials: sharedMat.map((m: any) => ({ path: m.path, type: m.type as 'image' | 'video' | 'audio' })),
                totalTasks: total,
                completedTasks: succeededCount,
                tasks: updatedBatch.map((bt: any) => ({
                  index: bt.index + 1,
                  prompt: bt.prompt,
                  status: (bt.status === 'downloaded' ? 'downloaded' : bt.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'downloaded' | 'failed',
                  outputFile: bt.outputFile,
                  error: bt.error,
                })),
                createdAt: new Date(batchInfoOnResult.createdAt).getTime(),
                completedAt: Date.now(),
              });
            }
            store.setBatchTasks([]);
            store.setBatchInfo(null);
          }
          const u = store.usage;
          store.updateUsage({ totalTasks: u.totalTasks + 1, completedTasks: u.completedTasks + 1, todayTasks: u.todayTasks + 1 });
          return;
        }

        const found = store.tasks.find((t: any) => t.submitId === data.data?.submitId);
        if (found) {
          const resolvedResultUrl = data.data.resultUrl || data.data.filePath || found.resultUrl || '';
          const resolvedLocalPath = data.data.filePath || found.localPath || '';
          const isDownloaded = Boolean(data.data.filePath);
          store.updateTask(found.id, {
            status: isDownloaded ? 'downloaded' : 'completed',
            filePath: data.data.filePath,
            resultUrl: resolvedResultUrl,
            localPath: resolvedLocalPath,
            downloaded: isDownloaded,
            progress: 100,
            completedAt: Date.now(),
          });
          store.addHistory({
            id: 'hist_' + Date.now(),
            submitId: found.submitId,
            prompt: found.prompt,
            model: found.model,
            duration: found.duration,
            resultUrl: resolvedResultUrl,
            localPath: resolvedLocalPath,
            createdAt: Date.now(),
            status: isDownloaded ? 'downloaded' : 'completed',
          });
          if (found.model === 'kling-o1') {
            const cost = (found.duration || 5) * 10;
            store.addMessage({ id: Date.now().toString() + '_kling_done', role: 'assistant', content: `✅ 可灵 O1 生成完成！已扣除 ${cost} 积分。${data.data.filePath ? `\n已保存至: ${data.data.filePath}` : ''}`, timestamp: new Date() });
          } else {
            store.addMessage({ id: Date.now().toString() + '_dl', role: 'system', content: `✅ 已下载: ${data.data?.filePath?.split('/').pop()}`, timestamp: new Date(), type: 'download' });
          }
        }
        const u = store.usage;
        store.updateUsage({ totalTasks: u.totalTasks + 1, completedTasks: u.completedTasks + 1, todayTasks: u.todayTasks + 1 });
        return;
      }

      if (data.event === 'failed') {
        // Check batchTasks first (Kling O1 batch path)
        const batchTasksOnFailed = store.batchTasks;
        const batchIdxOnFailed = batchTasksOnFailed.findIndex((bt: any) => bt.submitId === data.data?.submitId);
        if (batchIdxOnFailed !== -1) {
          const updatedBatch = batchTasksOnFailed.map((bt: any, i: number) =>
            i === batchIdxOnFailed
              ? { ...bt, status: 'failed' as const, error: data.data?.error || '生成失败' }
              : bt
          );
          store.setBatchTasks(updatedBatch);
          const failedTask = updatedBatch[batchIdxOnFailed];
          const cost = (failedTask?.duration || 5) * 10;
          store.addCredits(cost, '可灵 O1 批量任务失败退款');
          const allDone = updatedBatch.every((bt: any) => ['completed', 'downloaded', 'failed'].includes(bt.status));
          if (allDone) {
            const succeededCount = updatedBatch.filter((bt: any) => bt.status === 'completed' || bt.status === 'downloaded').length;
            const failedCount = updatedBatch.filter((bt: any) => bt.status === 'failed').length;
            const total = updatedBatch.length;
            const batchInfoOnFailed = store.batchInfo;
            store.addMessage({ id: Date.now().toString() + '_kbc', role: 'assistant', content: `📦 可灵批量任务完成!\n✅ ${succeededCount} 成功 / ❌ ${failedCount} 失败 / 共 ${total} 个任务`, timestamp: new Date() });
            if (batchInfoOnFailed && updatedBatch.length > 0) {
              const sharedMat = updatedBatch[0]?.materials ?? [];
              store.addBatchHistory({
                id: batchInfoOnFailed.id || ('batch_hist_' + Date.now()),
                name: batchInfoOnFailed.name || '可灵 O1 批量任务',
                description: batchInfoOnFailed.description || '',
                model: updatedBatch[0]?.model ?? 'kling-o1',
                duration: updatedBatch[0]?.duration ?? 5,
                aspectRatio: updatedBatch[0]?.aspectRatio ?? '9:16',
                sharedMaterials: sharedMat.map((m: any) => ({ path: m.path, type: m.type as 'image' | 'video' | 'audio' })),
                totalTasks: total,
                completedTasks: succeededCount,
                tasks: updatedBatch.map((bt: any) => ({
                  index: bt.index + 1,
                  prompt: bt.prompt,
                  status: (bt.status === 'downloaded' ? 'downloaded' : bt.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'downloaded' | 'failed',
                  outputFile: bt.outputFile,
                  error: bt.error,
                })),
                createdAt: new Date(batchInfoOnFailed.createdAt).getTime(),
                completedAt: Date.now(),
              });
            }
            store.setBatchTasks([]);
            store.setBatchInfo(null);
          }
          const u = store.usage;
          store.updateUsage({ totalTasks: u.totalTasks + 1, failedTasks: u.failedTasks + 1 });
          return;
        }

        const found = store.tasks.find((t: any) => t.submitId === data.data?.submitId);
        if (found) {
          store.updateTask(found.id, { status: 'failed', error: data.data?.error || '生成失败' });
          if (found.model === 'kling-o1') {
            const cost = (found.duration || 5) * 10;
            store.addCredits(cost, '可灵 O1 生成失败退款');
            store.addMessage({ id: Date.now().toString() + '_kling_fail', role: 'assistant', content: `❌ 可灵 O1 生成失败: ${data.data?.error || '未知错误'}\n已退还 ${cost} 积分`, timestamp: new Date(), type: 'error' });
          }
        }
        const u = store.usage;
        store.updateUsage({ totalTasks: u.totalTasks + 1, failedTasks: u.failedTasks + 1 });
        return;
      }

      if (data.event === 'queue-task-submitted') {
        store.addMessage({ id: Date.now().toString() + '_qs', role: 'system', content: `📋 队列任务已提交: ${data.data?.prompt?.slice(0, 40)}...`, timestamp: new Date() });
        return;
      }

      if (data.event === 'queue-task-failed') {
        store.addMessage({ id: Date.now().toString() + '_qf', role: 'system', content: `❌ 队列任务失败: ${data.data?.error}`, timestamp: new Date(), type: 'error' });
        return;
      }

      if (data.event === 'batch-complete') {
        const { succeeded, failed, total } = data.data;
        store.addMessage({ id: Date.now().toString() + '_bc', role: 'assistant', content: `📦 批量任务完成!\n✅ ${succeeded} 成功 / ❌ ${failed} 失败 / 共 ${total} 个任务`, timestamp: new Date() });
        const liveBatchTasks = store.batchTasks;
        const liveBatchInfo = store.batchInfo;
        if (liveBatchInfo && liveBatchTasks.length > 0) {
          const sharedMat = liveBatchTasks[0]?.materials ?? [];
          store.addBatchHistory({
            id: liveBatchInfo.id || ('batch_hist_' + Date.now()),
            name: liveBatchInfo.name || '批量任务',
            description: liveBatchInfo.description || '',
            model: liveBatchTasks[0]?.model ?? '',
            duration: liveBatchTasks[0]?.duration ?? 5,
            aspectRatio: liveBatchTasks[0]?.aspectRatio ?? '9:16',
            sharedMaterials: sharedMat.map((m: any) => ({ path: m.path, type: m.type as 'image' | 'video' | 'audio' })),
            totalTasks: total,
            completedTasks: succeeded,
            tasks: liveBatchTasks.map((bt: any) => ({
              index: bt.index + 1,
              prompt: bt.prompt,
              status: (bt.status === 'downloaded' ? 'downloaded' : bt.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'downloaded' | 'failed',
              outputFile: bt.outputFile,
              error: bt.error,
            })),
            createdAt: new Date(liveBatchInfo.createdAt).getTime(),
            completedAt: Date.now(),
          });
        }
        store.setBatchTasks([]);
        store.setBatchInfo(null);
        return;
      }

      if (data.event === 'batch-task-update') {
        const task = data.data;
        if (!task || task.index == null) return;
        const batchTasks = store.batchTasks;
        const updated = batchTasks.map((bt: any, idx: number) =>
          idx === task.index - 1
            ? { ...bt, status: task.status, outputFile: task.outputFile ?? bt.outputFile, error: task.error ?? bt.error, queuePosition: task.queuePosition ?? bt.queuePosition, queueStatus: task.queueStatus ?? bt.queueStatus, queueLength: task.queueLength ?? bt.queueLength }
            : bt
        );
        store.setBatchTasks(updated);
        const completedCount = updated.filter((t: any) => t.status === 'completed' || t.status === 'downloaded').length;
        const batchInfo = store.batchInfo;
        if (batchInfo) store.setBatchInfo({ ...batchInfo, completedTasks: completedCount });
        return;
      }
    });
    return () => removeProgress();
  }, []);

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
      useStore.getState().reconcileCreditsBalance();
      await initLocalFileServer();
      const savedSettings = await window.api.getSettings();
      if (savedSettings) setSettings(savedSettings);

      // Restore in-progress batch tasks from backend
      try {
        const batchStatus = await window.api.getBatchStatus();
        const restoredTasks = batchStatus.success ? (batchStatus.tasks as import('./store').BatchTaskItem[] | undefined) : undefined;
        if (restoredTasks && restoredTasks.length > 0) {
          const store = useStore.getState();
          const allDone = restoredTasks.every(t =>
            t.status === 'completed' || t.status === 'downloaded' || t.status === 'failed'
          );
          const batch = batchStatus.batch as any;
          if (allDone) {
            if (batch && !store.batchHistory.find(h => h.id === batch.id)) {
              const succeeded = restoredTasks.filter(t => t.status === 'completed' || t.status === 'downloaded').length;
              store.addBatchHistory({
                id: batch.id,
                name: batch.name || '批量任务',
                description: batch.description || '',
                model: restoredTasks[0]?.model ?? '',
                duration: restoredTasks[0]?.duration ?? 5,
                aspectRatio: restoredTasks[0]?.aspectRatio ?? '16:9',
                sharedMaterials: (restoredTasks[0]?.materials ?? []).map((m: any) => ({ path: m.path, type: m.type })),
                totalTasks: restoredTasks.length,
                completedTasks: succeeded,
                tasks: restoredTasks.map(bt => ({
                  index: bt.index,
                  prompt: bt.prompt,
                  status: (bt.status === 'downloaded' ? 'downloaded' : bt.status === 'failed' ? 'failed' : 'completed') as 'completed' | 'downloaded' | 'failed',
                  outputFile: bt.outputFile,
                  error: bt.error,
                })),
                createdAt: new Date(batch.createdAt).getTime(),
                completedAt: Date.now(),
              });
            }
            store.setBatchTasks([]);
            store.setBatchInfo(null);
          } else {
            store.setBatchTasks(restoredTasks);
            if (batchStatus.batch) store.setBatchInfo(batchStatus.batch);
            if (store.taskMode !== 'batch') store.setTaskMode('batch');
            store.setActivePanel('works');
          }
        }
      } catch (err) {
        console.error('[Init] getBatchStatus failed:', err);
      }

      // 拉取即梦账号余额缓存（不影响 VidClaw 积分）
      window.api.checkCredits().then((result: any) => {
        if (result.success && result.data?.totalCredit != null) {
          useStore.getState().setJimengBalance(result.data.totalCredit);
        } else if (result.success && typeof result.credits === 'number') {
          useStore.getState().setJimengBalance(result.credits);
        }
      }).catch(() => { /* silent fail — 启动时积分拉取失败不阻塞 */ });

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
