export {};

declare global {
  interface Window {
    api: {
      // 账号
      authLogin: () => Promise<{ success: boolean; qrPath?: string; message?: string; error?: string }>;
      authLogout: () => Promise<{ success: boolean; error?: string }>;
      checkCredits: () => Promise<{ success: boolean; isLoggedIn?: boolean; credits?: number; error?: string }>;

      // 浏览器控制（兼容旧接口）
      launchBrowser: () => Promise<{ success: boolean; error?: string }>;
      checkLogin: () => Promise<{ loggedIn: boolean }>;
      clickLogin: () => Promise<{ success: boolean }>;
      relaunchBrowser: () => Promise<{ success: boolean; error?: string }>;
      openJimeng: () => Promise<{ success: boolean; error?: string }>;

      // 任务（两步式）
      prepareTask: (input: string) => Promise<{ success: boolean; task?: any; error?: string }>;
      executeTask: (task: any) => Promise<{ success: boolean; submitId?: string; message?: string; error?: string }>;
      prepareTaskForSeedance: (input: string, materials: { images?: any[]; videos?: any[]; audios?: any[] }) => Promise<{ success: boolean; task?: any; materials?: any; error?: string }>;
      prepareBatchTasks: (input: string, materials?: { images: any[]; videos: any[]; audios: any[] }, defaults?: { model?: string; duration?: number; aspectRatio?: string }) => Promise<{ success: boolean; batchName?: string; description?: string; tasks?: any[]; questions?: string[]; error?: string }>;

      // 任务（兼容旧接口）
      submitTask: (input: string) => Promise<{ success: boolean; message?: string; error?: string }>;
      submitTaskWithFiles: (input: string, filePaths: string[]) => Promise<{ success: boolean; message?: string; error?: string }>;
      downloadTask: (item: {
        submitId?: string;
        url?: string;
        prompt?: string;
        model?: string;
        duration?: number;
        downloadDir?: string;
      }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      downloadAll: () => Promise<{ results: any[] }>;
      getResults: () => Promise<{ results: any[] }>;

      // 队列
      enqueueTask: (task: any) => Promise<{ success: boolean; queueStatus?: any }>;
      processQueue: () => Promise<{ success: boolean }>;
      getQueueStatus: () => Promise<{ queueStatus: any }>;

      // 结构化任务
      submitStructured: (params: { prompt: string; materials?: any[]; metaList?: any[]; model?: string; duration?: number; aspectRatio?: string }) => Promise<{ success: boolean; taskId?: string; uploadResults?: any[]; message?: string; error?: string }>;
      runStructuredTask: (params: { prompt: string; materials?: any[]; metaList?: any[]; model?: string; duration?: number; aspectRatio?: string }) => Promise<{ success: boolean; submitId?: string; taskId?: string; uploadResults?: any[]; message?: string; error?: string }>;
      uploadMaterials: (materials: Array<{ path: string; type: 'image' | 'video' }>) => Promise<{ success: boolean; results: Array<{ path: string; type: string; success: boolean; storeUri?: string; vid?: string; error?: string }> }>;
      getModels: () => Promise<{ models: Record<string, { key: string; label: string; benefit: string }>; aspectRatios: string[] }>;
      initMode: () => Promise<{ success: boolean; error?: string }>;
      navigateToGenerate: () => Promise<{ success: boolean; error?: string }>;
      switchToSeedanceMode: () => Promise<{ success: boolean; mode?: string; error?: string }>;
      selectModel: (model: string) => Promise<{ success: boolean; model?: string; label?: string; error?: string }>;
      setDuration: (seconds: number) => Promise<{ success: boolean; duration?: number; error?: string }>;
      setAspectRatio: (ratio: string) => Promise<{ success: boolean; ratio?: string; error?: string }>;

      // 批量任务
      createBatch: (batch: any, tasks: any[]) => Promise<{ success: boolean; batchId?: string; totalTasks?: number; error?: string }>;
      startBatch: () => Promise<{ success: boolean; error?: string }>;
      stopBatch: () => Promise<{ success: boolean; error?: string }>;
      getBatchStatus: () => Promise<{ success: boolean; batch?: any; tasks?: any[]; statusCounts?: any; running?: boolean; error?: string }>;
      updateBatchTask: (taskId: string, updates: any) => Promise<{ success: boolean; task?: any; error?: string }>;
      deleteBatchTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
      sendTaskNotify: (task: { id: string; prompt: string }) => Promise<void>;

      // 文件
      selectFiles: () => Promise<{ files: string[] }>;
      selectDownloadDir: () => Promise<{ dir: string }>;
      getFileStat: (filePath: string) => Promise<{ size: number }>;
      openDownloadDir: () => Promise<{ success: boolean; error?: string }>;
      openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;

      // 设置
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<{ success: boolean; settings?: any }>;
      getStatus: () => Promise<{ browserReady: boolean; isLoggedIn: boolean | null; version: string; resultsCount: number; queueStatus: any }>;

      // 事件
      onProgress: (callback: (data: any) => void) => () => void;
      onComplete: (callback: (data: any) => void) => () => void;
      onLoginRequired: (callback: () => void) => () => void;
      onLoginDetected: (callback: () => void) => () => void;
      onNotificationClick: (callback: (data: { taskId: string }) => void) => () => void;
      onNotificationClickV2: (callback: (data: { taskId: string; submitId: string }) => void) => () => void;
    };
  }
}
