const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 账号管理
  checkCredits: () => ipcRenderer.invoke('account:credits'),
  authLogin: () => ipcRenderer.invoke('auth:login'),
  authRelogin: () => ipcRenderer.invoke('auth:relogin'),
  authLogout: () => ipcRenderer.invoke('auth:logout'),

  // 浏览器控制（已废弃，保留接口兼容）
  launchBrowser: () => ipcRenderer.invoke('browser:launch'),
  checkLogin: () => ipcRenderer.invoke('browser:check-login'),
  clickLogin: () => ipcRenderer.invoke('browser:click-login'),
  relaunchBrowser: () => ipcRenderer.invoke('browser:relaunch'),
  openJimeng: () => ipcRenderer.invoke('browser:open-jimeng'),

  // 任务管理（两步式：先改写再执行）
  prepareTask: (input) => ipcRenderer.invoke('task:prepare', input),
  executeTask: (task) => ipcRenderer.invoke('task:execute', task),
  
  // Seedance 模式任务准备（带素材 @引用）
  prepareTaskForSeedance: (input, materials) => ipcRenderer.invoke('task:prepare-seedance', { input, materials }),
      // 批量任务准备
      prepareBatchTasks: (input, materials, defaults) => ipcRenderer.invoke('task:prepare-batch', { input, materials, defaults }),

  // 任务管理（兼容旧接口）
  submitTask: (input) => ipcRenderer.invoke('task:submit', input),
  submitTaskWithFiles: (input, filePaths) => ipcRenderer.invoke('task:submit-with-files', { input, filePaths }),
  downloadTask: (item) => ipcRenderer.invoke('task:download', item),
  downloadAll: () => ipcRenderer.invoke('task:download-all'),
  getResults: () => ipcRenderer.invoke('task:get-results'),

  // 任务队列
  enqueueTask: (task) => ipcRenderer.invoke('task:enqueue', task),
  processQueue: () => ipcRenderer.invoke('task:process-queue'),
  getQueueStatus: () => ipcRenderer.invoke('task:queue-status'),

  // 文件操作
  selectFiles: () => ipcRenderer.invoke('file:select'),
  selectDownloadDir: () => ipcRenderer.invoke('file:select-download-dir'),
  getFileStat: (filePath) => ipcRenderer.invoke('file:stat', filePath),
  getFileServerPort: () => ipcRenderer.invoke('file:server-port'),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // 应用状态
  getStatus: () => ipcRenderer.invoke('app:status'),
  openDownloadDir: () => ipcRenderer.invoke('app:open-download-dir'),
  openFile: (filePath) => ipcRenderer.invoke('app:open-file', filePath),

  // 事件监听
  onProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('task:progress', handler);
    return () => ipcRenderer.removeListener('task:progress', handler);
  },
  onComplete: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('task:complete', handler);
    return () => ipcRenderer.removeListener('task:complete', handler);
  },
  onLoginRequired: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('login:required', handler);
    return () => ipcRenderer.removeListener('login:required', handler);
  },
  onLoginDetected: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('login:detected', handler);
    return () => ipcRenderer.removeListener('login:detected', handler);
  },

  // Phase 1-3: 结构化自动化 API
  navigateToGenerate: () => ipcRenderer.invoke('automation:navigate'),
  switchToSeedanceMode: () => ipcRenderer.invoke('automation:switch-mode'),
  selectModel: (model) => ipcRenderer.invoke('automation:select-model', model),
  setDuration: (seconds) => ipcRenderer.invoke('automation:set-duration', seconds),
  setAspectRatio: (ratio) => ipcRenderer.invoke('automation:set-aspect-ratio', ratio),
  uploadMaterials: (materials) => ipcRenderer.invoke('automation:upload-materials', materials),
  submitStructured: (params) => ipcRenderer.invoke('automation:submit-structured', params),
  runStructuredTask: (params) => ipcRenderer.invoke('automation:run-structured', params),
  getModels: () => ipcRenderer.invoke('automation:get-models'),
  initMode: () => ipcRenderer.invoke('automation:init-mode'),

  // 批量任务 API
  createBatch: (batch, tasks) => ipcRenderer.invoke('batch:create', { batch, tasks }),
  startBatch: () => ipcRenderer.invoke('batch:start'),
  stopBatch: () => ipcRenderer.invoke('batch:stop'),
  getBatchStatus: () => ipcRenderer.invoke('batch:status'),
  updateBatchTask: (taskId, updates) => ipcRenderer.invoke('batch:update-task', { taskId, updates }),
  deleteBatchTask: (taskId) => ipcRenderer.invoke('batch:delete-task', { taskId }),

  // 通知
  sendTaskNotify: (task) => ipcRenderer.invoke('task:notify', task),
  onNotificationClick: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('notification-click', handler);
    return () => ipcRenderer.removeListener('notification-click', handler);
  },
  // 新增：notification:click 事件
  onNotificationClickV2: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('notification:click', handler);
    return () => ipcRenderer.removeListener('notification:click', handler);
  },
});
