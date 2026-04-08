const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { BrowserManager } = require('./services/browser');
const { AutomationService } = require('./services/automation');
const { BatchTaskManager } = require('./services/batch-task-manager');
const { AIService } = require('./services/ai');

// 🔴 禁用 GPU 加速（解决 macOS 黑屏问题）
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');

let mainWindow = null;
let browserManager = null;
let automationService = null;
let batchTaskManager = null;
let aiService = null;

const isDev = !app.isPackaged;

// ===== 热重载配置（开发模式下自动重载主进程代码）=====
if (isDev) {
  try {
    // 关键：热重载前先同步源码到 dist/electron/
    const syncToDist = () => {
      const srcDir = path.join(__dirname, '..', 'electron');
      const distDir = path.join(__dirname, '..', 'dist', 'electron');
      
      // 递归复制目录
      const copyDir = (src, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };
      
      try {
        copyDir(srcDir, distDir);
        console.log('[热重载] ✅ 已同步 electron/ → dist/electron/');
      } catch (e) {
        console.warn('[热重载] ⚠️ 同步失败:', e.message);
      }
    };
    
    // 启动时先同步一次
    syncToDist();
    
    require('electron-reload')(
      [
        path.join(__dirname, 'main.js'),
        path.join(__dirname, 'services'),
        path.join(__dirname, '../dist/renderer'),
      ],
      {
        electron: require.resolve('electron'),
        hardResetMethod: 'exit',
        awaitWriteFinish: true,
      }
    );
    console.log('[热重载] ✅ 已启用主进程热重载');
  } catch (e) {
    console.warn('[热重载] ⚠️ 加载失败:', e.message);
  }
}

// ===== 用户设置持久化 =====
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch {}
  return {
    downloadDir: path.join(app.getPath('downloads'), '即梦'),
    autoDownload: false,
    apiKey: 'sk-4b2f09aa14204571b1b33a5d97839a63', // DeepSeek API
    model: 'deepseek-chat',
  };
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.warn('保存设置失败:', e.message);
  }
}

let settings = loadSettings();

// ===== 单实例锁定（开发模式下禁用，避免热重载冲突）=====
let gotTheLock = true; // 默认允许启动
if (!isDev) {
  gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    console.log('已有实例在运行，退出当前实例');
    app.quit();
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });
  }
}

// ===== Vite 就绪检测 =====
function waitForVite(port, maxWait = 15000) {
  return new Promise((resolve) => {
    const start = Date.now();
    function check() {
      const req = http.get(`http://localhost:${port}`, () => {
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > maxWait) {
          console.log(`Vite 在 ${maxWait}ms 内未就绪`);
          resolve(false);
        } else {
          setTimeout(check, 500);
        }
      });
      req.end();
    }
    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 960,
    minHeight: 640,
    title: 'VidClaw',
    backgroundColor: '#030712',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    const viteReady = await waitForVite(5173);
    if (viteReady) {
      await mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadURL(`data:text/html,
        <html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center">
            <h2>⏳ 等待前端服务启动...</h2>
            <p style="color:#888">请先运行: npx vite</p>
          </div>
        </body></html>
      `);
    }
  } else {
    // 🔴 生产模式：使用 app.asar 内的路径
    const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
    console.log('加载渲染器:', rendererPath);
    console.log('文件是否存在:', fs.existsSync(rendererPath));
    
    try {
      await mainWindow.loadFile(rendererPath);
      console.log('渲染器加载成功');
    } catch (err) {
      console.error('渲染器加载失败:', err);
      // 显示错误信息
      mainWindow.loadURL(`data:text/html,
        <html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center">
            <h2>❌ 加载失败</h2>
            <p style="color:#888">${err.message}</p>
            <p style="color:#666">路径: ${rendererPath}</p>
          </div>
        </body></html>
      `);
    }
  }

  // 🔴 开发工具（生产模式也开启，方便调试）
  mainWindow.webContents.openDevTools();
  
  // 🔴 捕获渲染进程错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('渲染进程加载失败:', errorCode, errorDescription);
  });
  
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log('[渲染进程]', message);
  });
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ 页面加载完成');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ===== 推送事件到渲染进程 =====
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

// ===== Mac 原生通知 =====
function sendTaskNotification(task) {
  if (!Notification.isSupported()) return;
  const notif = new Notification({
    title: 'VidClaw',
    body: `✅ 「${(task.prompt || '').slice(0, 20)}」已生成完成`,
    silent: false,
  });
  notif.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('notification-click', { taskId: task.id });
    }
  });
  notif.show();
}

// ===== 确保 AI 服务已初始化 =====
function ensureAIService() {
  if (!aiService) {
    const apiKey = settings.apiKey || 'sk-4b2f09aa14204571b1b33a5d97839a63';
    const model = settings.model || 'deepseek-chat';
    aiService = new AIService(apiKey, model);
  }
  return aiService;
}

// ===== 确保自动化服务已初始化 =====
function ensureAutomationService() {
  if (!automationService && browserManager && browserManager.isReady()) {
    const page = browserManager.getPage();
    if (page) {
      automationService = new AutomationService(page, settings.downloadDir);
      automationService.startApiInterception();
      automationService.on((event, data) => {
        sendToRenderer('task:progress', { event, data });
      });
    }
  }
  return automationService;
}

// ===== IPC Handlers =====
function registerIpcHandlers() {

  // ---- 浏览器控制 ----
  ipcMain.handle('browser:launch', async () => {
    try {
      if (!browserManager) {
        const userDataPath = app.getPath('userData');
        browserManager = new BrowserManager(userDataPath);
      }
      await browserManager.launch();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('browser:check-login', async () => {
    if (!browserManager) return { loggedIn: false };
    try {
      const loggedIn = await browserManager.isLoggedIn();
      return { loggedIn };
    } catch {
      return { loggedIn: false };
    }
  });

  ipcMain.handle('browser:click-login', async () => {
    if (!browserManager) return { success: false };
    try {
      const result = await browserManager.clickLoginButton();
      return { success: result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 打开即梦页面（导航到指定 URL） ----
  ipcMain.handle('browser:open-jimeng', async () => {
    try {
      if (!browserManager) {
        const userDataPath = app.getPath('userData');
        browserManager = new BrowserManager(userDataPath);
      }
      await browserManager.launch();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 新：两步任务提交 —— Step 1: AI 改写（不执行） ----
  ipcMain.handle('task:prepare', async (_event, input) => {
    console.log('[准备任务] 输入:', input?.slice?.(0, 80));

    try {
      const ai = ensureAIService();
      const task = await ai.rewritePrompt(input);
      console.log('[准备任务] AI 改写结果:', JSON.stringify(task).slice(0, 200));
      return { success: true, task };
    } catch (err) {
      console.error('[准备任务] 失败:', err.message);
      // 兜底：用原始输入
      return {
        success: true,
        task: { prompt: input, duration: 5, aspectRatio: '16:9', type: 'video' },
      };
    }
  });

  // ---- Seedance 模式任务准备（带素材 @引用） ----
  ipcMain.handle('task:prepare-seedance', async (_event, { input, materials }) => {
    console.log('[Seedance准备] 输入:', input?.slice?.(0, 80));
    console.log('[Seedance准备] 素材:', materials ? `${materials.images?.length || 0}图 ${materials.videos?.length || 0}视频 ${materials.audios?.length || 0}音频` : '无');

    try {
      const ai = ensureAIService();
      const task = await ai.rewritePromptForSeedance(input, materials);
      console.log('[Seedance准备] AI 改写结果:', JSON.stringify(task).slice(0, 300));
      return { success: true, task, materials };
    } catch (err) {
      console.error('[Seedance准备] 失败:', err.message);
      return {
        success: true,
        task: { 
          prompt: input, 
          reason: 'AI 改写失败，使用原始输入',
          duration: 5, 
          aspectRatio: '16:9' 
        },
        materials,
      };
    }
  });

  // ---- 批量任务生成 ----
  ipcMain.handle('task:prepare-batch', async (_event, input) => {
    console.log('[批量准备] 输入:', input?.slice?.(0, 100));

    try {
      const ai = ensureAIService();
      const result = await ai.generateBatchTasks(input);
      console.log('[批量准备] AI 生成结果:', JSON.stringify(result).slice(0, 500));
      return { success: true, ...result };
    } catch (err) {
      console.error('[批量准备] 失败:', err.message);
      return { 
        success: false, 
        error: err.message,
        questions: ['请告诉我这次批量测试的目标是什么？', '你想生成多少个视频？']
      };
    }
  });

  // ---- 新：两步任务提交 —— Step 2: 执行（填写+提交，含重试） ----
  ipcMain.handle('task:execute', async (_event, task) => {
    console.log('[执行任务] 任务:', JSON.stringify(task).slice(0, 200));

    if (!browserManager || !browserManager.isReady()) {
      return { success: false, error: '浏览器未就绪，请先打开即梦并登录' };
    }

    try {
      const automation = ensureAutomationService();
      if (!automation) {
        return { success: false, error: '自动化服务初始化失败' };
      }

      // 带重试的任务执行
      const maxRetries = 3;
      const retryDelays = [10000, 30000, 60000]; // 10s, 30s, 60s
      let lastError;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await automation.runTask({
            prompt: task.prompt,
            files: task.files || [],
          });

          return {
            success: true,
            message: attempt > 0 ? `任务已提交（第${attempt + 1}次尝试成功）` : '任务已提交',
            prompt: task.prompt,
            type: task.type,
          };
        } catch (err) {
          lastError = err;
          const errMsg = err.message || '';

          // 判断是否可重试：网络超时/500错误才重试
          const isRetryable = /timeout|ETIMEDOUT|ECONNRESET|5\d{2}|network|socket/i.test(errMsg);

          if (!isRetryable || attempt >= maxRetries) {
            break;
          }

          console.log(`[执行任务] 第${attempt + 1}次失败，${retryDelays[attempt] / 1000}秒后重试: ${errMsg}`);
          sendToRenderer('task:progress', {
            event: 'progress',
            data: {
              progressType: 'generating',
              message: `⚠️ 遇到错误，${retryDelays[attempt] / 1000}秒后自动重试（${attempt + 1}/${maxRetries}）`,
            },
          });
          await new Promise(r => setTimeout(r, retryDelays[attempt]));
        }
      }

      return { success: false, error: lastError?.message || '任务执行失败' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 任务提交（单个，兼容旧接口） ----
  ipcMain.handle('task:submit', async (_event, input) => {
    console.log('收到任务:', input?.slice?.(0, 80));

    if (!browserManager || !browserManager.isReady()) {
      return { success: false, error: '浏览器未就绪，请先启动并登录即梦' };
    }

    try {
      const ai = ensureAIService();
      const automation = ensureAutomationService();

      // Step 1: AI 改写 prompt
      sendToRenderer('task:progress', { event: 'ai-thinking', data: { message: 'AI 正在优化提示词...' } });
      let task;
      try {
        task = await ai.rewritePrompt(input);
        console.log('[AI] 改写结果:', JSON.stringify(task).slice(0, 200));
      } catch (err) {
        console.error('[AI] 改写失败:', err.message);
        task = { prompt: input, duration: 5, aspectRatio: '16:9', type: 'video' };
      }

      sendToRenderer('task:progress', {
        event: 'ai-rewritten',
        data: { original: input, task }
      });

      // Step 2: 运行任务
      const result = await automation.runTask({
        prompt: task.prompt,
        files: [],
      });
      return {
        success: true,
        message: '任务已提交',
        prompt: task.prompt,
        type: task.type,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 任务提交（带文件，兼容旧接口） ----
  ipcMain.handle('task:submit-with-files', async (_event, { input, filePaths }) => {
    console.log('收到任务(含文件):', input?.slice?.(0, 60), '文件数:', filePaths?.length);

    if (!browserManager || !browserManager.isReady()) {
      return { success: false, error: '浏览器未就绪' };
    }

    try {
      const ai = ensureAIService();
      const automation = ensureAutomationService();

      let task;
      try {
        sendToRenderer('task:progress', { event: 'ai-thinking', data: { message: 'AI 正在优化提示词...' } });
        task = await ai.rewritePrompt(input);
      } catch (err) {
        task = { prompt: input, duration: 5, aspectRatio: '16:9', type: 'video' };
      }

      sendToRenderer('task:progress', { event: 'ai-rewritten', data: { original: input, task } });

      const result = await automation.runTask({
        prompt: task.prompt,
        files: filePaths || [],
      });
      return { success: true, message: '任务已提交', prompt: task.prompt };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 批量任务入队 ----
  ipcMain.handle('task:enqueue', async (_event, task) => {
    if (!automationService) return { success: false, error: '服务未初始化' };
    automationService.enqueue(task);
    return { success: true, queueStatus: automationService.getQueueStatus() };
  });

  // ---- 启动队列处理 ----
  ipcMain.handle('task:process-queue', async () => {
    if (!automationService) return { success: false, error: '服务未初始化' };
    automationService.processQueue().catch(err => {
      console.error('队列处理错误:', err);
    });
    return { success: true };
  });

  // ---- 获取队列状态 ----
  ipcMain.handle('task:queue-status', async () => {
    if (!automationService) return { queueStatus: { pending: 0, processing: 0, total: 0, isProcessing: false } };
    return { queueStatus: automationService.getQueueStatus() };
  });

  // ---- 下载单个作品 ----
  ipcMain.handle('task:download', async (_event, item) => {
    if (!automationService) return { success: false, error: '服务未初始化' };
    try {
      let lastErr;
      for (let i = 0; i < 3; i++) {
        try {
          const result = await automationService.downloadFile(item);
          return result;
        } catch (err) {
          lastErr = err;
          if (i < 2) await new Promise(r => setTimeout(r, 1000));
        }
      }
      throw lastErr;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 下载全部 ----
  ipcMain.handle('task:download-all', async () => {
    if (!automationService) return { results: [], error: '服务未初始化' };
    const results = await automationService.downloadAll();
    return { results };
  });

  // ---- 获取已拦截结果 ----
  ipcMain.handle('task:get-results', async () => {
    if (!automationService) return { results: [] };
    return { results: automationService.getResults() };
  });

  // ---- 选择文件 ----
  ipcMain.handle('file:select', async () => {
    if (!mainWindow) return { files: [] };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择素材文件',
      filters: [
        { name: '所有支持格式', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'webm'] },
        { name: '仅图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        { name: '仅视频', extensions: ['mp4', 'mov', 'avi', 'webm'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return { files: [] };
    return { files: result.filePaths };
  });

  // ---- 选择下载目录 ----
  ipcMain.handle('file:select-download-dir', async () => {
    if (!mainWindow) return { dir: '' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择下载目录',
      defaultPath: settings.downloadDir,
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled) return { dir: '' };
    return { dir: result.filePaths[0] };
  });

  // ---- 设置管理 ----
  ipcMain.handle('settings:get', async () => {
    return { ...settings };
  });

  ipcMain.handle('settings:save', async (_event, newSettings) => {
    settings = { ...settings, ...newSettings };
    saveSettings(settings);

    if (newSettings.apiKey !== undefined) {
      aiService = null;
    }

    return { success: true, settings: { ...settings } };
  });

  // ---- 应用状态 ----
  ipcMain.handle('app:status', async () => {
    const loginStatus = automationService
      ? await automationService.checkLoginStatus()
      : null;

    return {
      browserReady: browserManager?.isReady() ?? false,
      isLoggedIn: loginStatus,
      version: app.getVersion(),
      resultsCount: automationService?.getResults()?.length ?? 0,
      queueStatus: automationService?.getQueueStatus() ?? { pending: 0, processing: 0, total: 0, isProcessing: false },
    };
  });

  // ---- 打开下载目录 ----
  ipcMain.handle('app:open-download-dir', async () => {
    const dir = settings.downloadDir;
    if (fs.existsSync(dir)) {
      const { shell } = require('electron');
      await shell.openPath(dir);
      return { success: true };
    }
    return { success: false, error: '目录不存在' };
  });

  // ---- 打开单个文件（用系统默认程序预览） ----
  ipcMain.handle('app:open-file', async (_event, filePath) => {
    try {
      const { shell } = require('electron');
      if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return { success: true };
      }
      return { success: false, error: '文件不存在' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // ---- 重启浏览器（重新登录，强制可见窗口） ----
  ipcMain.handle('browser:relaunch', async () => {
    try {
      if (automationService) {
        automationService.destroy();
        automationService = null;
      }
      if (browserManager) {
        await browserManager.close();
        browserManager = null;
      }
      const userDataPath = app.getPath('userData');
      browserManager = new BrowserManager(userDataPath);
      await browserManager.launch(true); // forceVisible = true，让用户扫码
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ====================================================================
  // Phase 1-3: 结构化自动化 IPC handlers
  // ====================================================================

  // ---- 导航到即梦生成页面 ----
  ipcMain.handle('automation:navigate', async () => {
    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };
      const result = await automation.navigateToGenerate();
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 切换到 Seedance 全能参考模式 ----
  ipcMain.handle('automation:switch-mode', async () => {
    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };
      const result = await automation.switchToSeedanceMode();
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 选择模型 ----
  ipcMain.handle('automation:select-model', async (_event, model) => {
    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };
      const result = await automation.selectModel(model);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 设置时长 ----
  ipcMain.handle('automation:set-duration', async (_event, seconds) => {
    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };
      const result = await automation.setDuration(seconds);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 设置比例 ----
  ipcMain.handle('automation:set-aspect-ratio', async (_event, ratio) => {
    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };
      const result = await automation.setAspectRatio(ratio);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 上传素材 ----
  ipcMain.handle('automation:upload-materials', async (_event, materials) => {
    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };
      const result = await automation.uploadMaterials(materials);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 提交结构化生成（直接调用 API） ----
  ipcMain.handle('automation:submit-structured', async (_event, { prompt, materials, metaList, model, duration, aspectRatio }) => {
    console.log('[结构化提交] 参数:', { prompt: (prompt || '').slice(0, 60), materialCount: (materials || []).length, model, duration, aspectRatio });

    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };

      // 上传素材
      let uploadResults = [];
      if (materials && materials.length > 0) {
        const uploadResult = await automation.uploadMaterials(materials);
        uploadResults = uploadResult.results || [];
      }

      // 构造 draft_content
      const uploadedMaterials = uploadResults.filter(r => r.success).map(r => ({
        type: r.type,
        storeUri: r.storeUri,
        vid: r.vid,
      }));

      const draftContent = automation.buildDraftContent({
        materials: uploadedMaterials,
        metaList: metaList || null,
        options: { prompt, duration, aspectRatio, model },
      });

      // 提交
      const submitResult = await automation.submitGeneration({
        draftContent,
        options: { model },
      });

      // 异步轮询
      if (submitResult.taskId) {
        automation.pollTaskStatus(submitResult.taskId).then((result) => {
          if (result.success && result.data) {
            sendToRenderer('task:progress', { event: 'result', data: result.data });
          }
        }).catch((err) => {
          console.error('[结构化提交] 轮询失败:', err.message);
        });
      }

      return {
        success: true,
        taskId: submitResult.taskId,
        uploadResults,
        message: '结构化任务已提交',
      };
    } catch (err) {
      console.error('[结构化提交] 失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ---- 完整结构化任务（模式切换 + 参数 + 上传 + 提交） ----
  ipcMain.handle('automation:run-structured', async (_event, { prompt, materials, metaList, model, duration, aspectRatio }) => {
    console.log('[结构化任务] 完整流程:', { prompt: (prompt || '').slice(0, 60), model, duration, aspectRatio });

    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };

      const result = await automation.runStructuredTask({
        prompt,
        materials: materials || [],
        metaList: metaList || null,
        model,
        duration,
        aspectRatio,
      });

      return result;
    } catch (err) {
      console.error('[结构化任务] 失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ---- 获取支持的模型列表 ----
  ipcMain.handle('automation:get-models', async () => {
    const { MODEL_MAP, ASPECT_RATIOS } = require('./services/automation');
    return { models: MODEL_MAP, aspectRatios: ASPECT_RATIOS };
  });

  // ---- 登录后自动初始化模式（打开页面即执行三步切换）----
  ipcMain.handle('automation:init-mode', async () => {
    try {
      const automation = ensureAutomationService();
      if (!automation) return { success: false, error: '自动化服务未就绪' };

      // 先导航到生成页
      await automation.navigateToGenerate();
      // 然后执行三步模式切换
      const result = await automation.switchToSeedanceMode();
      return result;
    } catch (err) {
      console.error('[自动化] 初始化模式失败:', err.message);
      return { success: false, error: err.message };
    }
  });

  // ═══════════════════════════════════════════
  // 批量任务 API
  // ═══════════════════════════════════════════

  function ensureBatchTaskManager() {
    if (!batchTaskManager) {
      const automation = ensureAutomationService();
      const downloadDir = settings.downloadDir || path.join(app.getPath('downloads'), '即梦');
      batchTaskManager = new BatchTaskManager(automation, downloadDir);
      // 批量完成时通知渲染进程
      batchTaskManager.setOnCompleteCallback((summary) => {
        sendToRenderer('task:progress', {
          event: 'batch-complete',
          data: summary,
        });
      });
    }
    return batchTaskManager;
  }

  // 创建批量任务
  ipcMain.handle('batch:create', async (_event, { batch, tasks }) => {
    try {
      const manager = ensureBatchTaskManager();
      return manager.createBatch(batch, tasks);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 开始执行批量任务
  ipcMain.handle('batch:start', async () => {
    try {
      const manager = ensureBatchTaskManager();
      return manager.start();
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 停止批量任务
  ipcMain.handle('batch:stop', async () => {
    try {
      const manager = ensureBatchTaskManager();
      manager.stop();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 获取批量任务状态
  ipcMain.handle('batch:status', async () => {
    try {
      const manager = ensureBatchTaskManager();
      return { success: true, ...manager.getStatus() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 更新批量任务
  ipcMain.handle('batch:update-task', async (_event, { taskId, updates }) => {
    try {
      const manager = ensureBatchTaskManager();
      const task = manager.tasks.find(t => t.id === taskId);
      if (!task) {
        return { success: false, error: '任务不存在' };
      }
      Object.assign(task, updates);
      manager._persistTasks();
      return { success: true, task };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 删除批量任务
  ipcMain.handle('batch:delete-task', async (_event, { taskId }) => {
    try {
      const manager = ensureBatchTaskManager();
      const index = manager.tasks.findIndex(t => t.id === taskId);
      if (index === -1) {
        return { success: false, error: '任务不存在' };
      }
      // 只能删除 pending 状态的任务
      if (manager.tasks[index].status !== 'pending') {
        return { success: false, error: '只能删除等待中的任务' };
      }
      manager.tasks.splice(index, 1);
      manager._persistTasks();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 获取 debug 日志（最近 N 行）----
  ipcMain.handle('debug:get-log', async (_event, { lines = 50 } = {}) => {
    try {
      const downloadsDir = settings.downloadDir || path.join(app.getPath('downloads'), '即梦');
      const logFile = path.join(downloadsDir, 'automation-debug.log');
      if (!fs.existsSync(logFile)) return { success: true, content: '(无日志文件)', logFile };
      const content = fs.readFileSync(logFile, 'utf8');
      const allLines = content.split('\n');
      const recent = allLines.slice(-lines).join('\n');
      return { success: true, content: recent, totalLines: allLines.length, logFile };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 打开 debug 日志文件 ----
  ipcMain.handle('debug:open-log', async () => {
    try {
      const downloadsDir = settings.downloadDir || path.join(app.getPath('downloads'), '即梦');
      const logFile = path.join(downloadsDir, 'automation-debug.log');
      if (fs.existsSync(logFile)) {
        const { shell } = require('electron');
        await shell.openPath(logFile);
        return { success: true };
      }
      return { success: false, error: '日志文件不存在' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // ---- 任务完成通知 ----
  ipcMain.handle('task:notify', async (_event, task) => {
    sendTaskNotification(task);
    return { success: true };
  });
}

// ===== 启动 =====
if (gotTheLock) {
  app.whenReady().then(async () => {
    registerIpcHandlers();
    await createWindow();
  });

  app.on('window-all-closed', async () => {
    if (automationService) automationService.destroy();
    if (browserManager) await browserManager.close();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });

  app.on('before-quit', async () => {
    if (automationService) automationService.destroy();
    if (browserManager) await browserManager.close();
  });
}
