const { app, BrowserWindow, ipcMain, dialog, Notification, protocol, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const { slugify, makeVideoName } = require('./videoName');

/**
 * 安全重命名：如果目标文件已存在则追加 _2, _3, ...
 */
function safeRename(src, dest) {
  if (src === dest) return src;
  const ext = path.extname(dest);
  const base = dest.slice(0, dest.length - ext.length);
  let target = dest;
  let counter = 2;
  // Try-rename loop: avoids TOCTOU by letting the OS signal collision via EEXIST
  for (;;) {
    try {
      fs.renameSync(src, target);
      return target;
    } catch (e) {
      if (e.code === 'EEXIST') {
        target = `${base}_${counter}${ext}`;
        counter++;
      } else {
        // ENOENT: src already gone; ENOTEMPTY: dest is a directory (Windows) — bail
        console.warn('[重命名] 失败:', e.message);
        return src;
      }
    }
  }
}

// 即梦 CLI 路径（开发模式 vs 生产模式）
function getDreaminaBin() {
  const isDev = !app.isPackaged;
  if (isDev) {
    // 开发模式：使用本地安装的 dreamina
    return path.join(process.env.HOME, '.local', 'bin', 'dreamina');
  }
  // 生产模式：使用打包进 resources 的二进制
  const platform = process.platform;
  const arch = process.arch;
  const ext = platform === 'win32' ? '.exe' : '';
  const binName = `dreamina-${platform}-${arch}${ext}`;
  return path.join(process.resourcesPath, binName);
}

const DREAMINA_BIN = getDreaminaBin();
console.log('[CLI] 即梦 CLI 路径:', DREAMINA_BIN);

// CLI 调用辅助函数
async function callDreamina(args, timeout = 30000) {
  try {
    const { stdout, stderr } = await execFileAsync(DREAMINA_BIN, args, { timeout });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    const msg = err.stderr || err.message || '';
    return { success: false, error: msg, code: err.code };
  }
}

// JSON 解析辅助
function parseCliJson(stdout) {
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

function isRemoteHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function downloadRemoteVideo(videoUrl, outputPath, redirectDepth = 0) {
  return new Promise((resolve, reject) => {
    if (redirectDepth > 10) return reject(new Error('Too many redirects'));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const urlObj = new URL(videoUrl);
    const transport = urlObj.protocol === 'https:' ? https : http;
    const file = fs.createWriteStream(outputPath);

    const handleResponse = (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(outputPath); } catch {}
        const location = response.headers.location;
        if (!location) return reject(new Error('Redirect without location'));
        return downloadRemoteVideo(location, outputPath, redirectDepth + 1).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(outputPath); } catch {}
        return reject(new Error(`HTTP ${response.statusCode}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', (err) => {
        try { fs.unlinkSync(outputPath); } catch {}
        reject(err);
      });
    };

    transport.get(videoUrl, handleResponse).on('error', (err) => {
      try { fs.unlinkSync(outputPath); } catch {}
      reject(err);
    });
  });
}

// Register local-file:// as a privileged streaming scheme BEFORE app.ready.
// stream:true  → byte-range requests are supported (required for video seek/play)
// secure:true  → treated as secure context (allows media autoplay, canvas access)
// bypassCSP    → not blocked by http://localhost:5173 content security policy
protocol.registerSchemesAsPrivileged([{
  scheme: 'local-file',
  privileges: { standard: true, stream: true, secure: true, bypassCSP: true, supportFetchAPI: true, allowServiceWorkers: true, corsEnabled: true },
}]);

// 🔴 禁用 GPU 加速（解决 macOS 黑屏问题）
// NOTE: disable-software-rasterizer and disable-gpu-compositing were removed —
// they break canvas.drawImage (thumbnail capture) and can crash Electron 37+ (issue #42688).
// disableHardwareAcceleration + disable-gpu is sufficient for the black-screen fix.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');

let mainWindow = null;
let aiService = null;
let localFileServerPort = null;

// ===== 本地文件 HTTP 服务器 =====
// protocol.handle 在 Electron 37+ 中对 Range 请求有已知 Bug (#38749)，
// 视频无法 seek / 生成缩略图。解决方案：起一个本地 HTTP 服务器，
// 渲染进程通过 http://127.0.0.1:PORT/file?path=... 访问本地文件。
function startLocalFileServer() {
  return new Promise((resolve) => {
    const MIME = {
      '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
      '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
    };
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const filePath = decodeURIComponent(url.searchParams.get('path') || '');
        if (!filePath || !path.isAbsolute(filePath)) {
          res.writeHead(400); res.end('Bad path'); return;
        }
        let stat;
        try { stat = fs.statSync(filePath); } catch {
          res.writeHead(404); res.end('Not found'); return;
        }
        const fileSize = stat.size;
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME[ext] || 'application/octet-stream';
        const range = req.headers.range;
        const corsHeaders = { 'Access-Control-Allow-Origin': '*' };
        if (req.method === 'OPTIONS') {
          res.writeHead(204, corsHeaders); res.end(); return;
        }
        if (range) {
          const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
          const start = parseInt(startStr, 10);
          const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
          if (isNaN(start) || start >= fileSize) {
            res.writeHead(416, { 'Content-Range': `bytes */${fileSize}`, ...corsHeaders }); res.end(); return;
          }
          const chunkSize = end - start + 1;
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': mimeType,
            ...corsHeaders,
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': mimeType,
            ...corsHeaders,
          });
          fs.createReadStream(filePath).pipe(res);
        }
      } catch (err) {
        res.writeHead(500); res.end('Server error');
      }
    });
    server.listen(0, '127.0.0.1', () => {
      localFileServerPort = server.address().port;
      console.log(`[FileServer] 本地文件服务器启动，端口: ${localFileServerPort}`);
      resolve(localFileServerPort);
    });
  });
}

const isDev = !app.isPackaged;

// ===== 热重载配置（开发模式下自动重载主进程代码）=====
if (isDev) {
  try {
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
    autoDownload: true,
    apiKey: 'sk-4b2f09aa14204571b1b33a5d97839a63',
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
let gotTheLock = true;
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
  // 检测 CLI 是否存在
  if (!fs.existsSync(DREAMINA_BIN)) {
    const errorMsg = isDev 
      ? `即梦 CLI 未安装，请先安装: npm install -g @jimeng/dreamina`
      : `程序配置缺失，请重新安装 VidClaw`;
    
    console.error('[CLI] 错误:', errorMsg);
    
    mainWindow = new BrowserWindow({
      width: 500,
      height: 300,
      title: 'VidClaw - 配置错误',
      backgroundColor: '#030712',
      resizable: false,
    });
    
    mainWindow.loadURL(`data:text/html,
      <html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui">
        <div style="text-align:center;padding:20px">
          <h2 style="margin-bottom:16px">❌ 配置错误</h2>
          <p style="color:#888;line-height:1.6">${errorMsg}</p>
        </div>
      </body></html>
    `);
    return;
  }
  
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
      // DevTools 默认关闭，用户可用快捷键 Cmd+Option+I 打开
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
    const rendererPath = path.join(__dirname, '../dist/renderer/index.html');
    try {
      await mainWindow.loadFile(rendererPath);
    } catch (err) {
      mainWindow.loadURL(`data:text/html,
        <html><body style="background:#030712;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">
          <div style="text-align:center">
            <h2>❌ 加载失败</h2>
            <p style="color:#888">${err.message}</p>
          </div>
        </body></html>
      `);
    }
  }

  // DevTools 默认关闭
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
    try {
      mainWindow.webContents.send(channel, data);
      console.log('[sendToRenderer] ✅ 已发送:', channel, data.event);
      return true;
    } catch (err) {
      console.error('[sendToRenderer] ❌ 发送失败:', err.message);
      return false;
    }
  }
  console.warn('[sendToRenderer] ❌ mainWindow 不可用');
  return false;
}

// ===== Mac 原生通知（增强版） =====
const NOTIFICATION_ICON = path.join(__dirname, '../resources/icon.png');

function sendTaskNotification(task) {
  if (!Notification.isSupported()) return;
  console.log('[通知] 发送单个任务通知:', task.prompt?.slice(0, 30));
  const notif = new Notification({
    title: 'VidClaw',
    body: `✅ 「${(task.prompt || '').slice(0, 20)}」已生成完成`,
    silent: false,
    icon: fs.existsSync(NOTIFICATION_ICON) ? NOTIFICATION_ICON : undefined,
  });
  notif.show();
  notif.on('click', () => {
    console.log('[通知] 点击通知，跳转到应用');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      // 发送事件让前端高亮该任务
      sendToRenderer('notification:click', { taskId: task.id, submitId: task.submitId });
    }
  });
}

// 批量任务完成汇总通知
function sendBatchCompleteNotification(summary) {
  if (!Notification.isSupported()) return;
  const { succeeded, failed, total, batch } = summary;
  console.log(`[通知] 发送批量完成通知: ${succeeded}成功/${failed}失败`);
  
  const body = failed > 0
    ? `批量任务完成: ${succeeded}个成功, ${failed}个失败`
    : `批量任务完成: ${total}个视频已生成`;
  const notif = new Notification({
    title: 'VidClaw - 批量任务',
    body,
    silent: false,
    icon: fs.existsSync(NOTIFICATION_ICON) ? NOTIFICATION_ICON : undefined,
  });
  notif.show();
  notif.on('click', () => {
    console.log('[通知] 点击批量通知，跳转到应用');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      // 打开批次目录
      if (batch?.downloadDir && fs.existsSync(batch.downloadDir)) {
        const { shell } = require('electron');
        shell.openPath(batch.downloadDir);
      }
    }
  });
}

// ===== AI 服务（DeepSeek 改写，保留） =====
const { AIService } = require('./services/ai');
function ensureAIService() {
  if (!aiService) {
    const apiKey = settings.apiKey || 'sk-4b2f09aa14204571b1b33a5d97839a63';
    const model = settings.model || 'deepseek-chat';
    aiService = new AIService(apiKey, model);
  }
  return aiService;
}

// ===== 任务状态轮询（自适应 setTimeout） =====
const POLL_INTERVAL_INITIAL  =   5_000; // 首次：提交后 5s 快速取位置
const POLL_INTERVAL_QUEUED   = 180_000; // 排队中：每 3 分钟（Seedance 队列每位约需数分钟）
const POLL_INTERVAL_FALLBACK =  30_000; // 未知状态兜底

const pollingTasks = new Map(); // submit_id -> { timer, task, cancelled }

function startPolling(submitId, task) {
  if (pollingTasks.has(submitId)) return;

  console.log(`[轮询] 开始轮询 submit_id=${submitId}`);

  const entry = { timer: null, task, cancelled: false };
  pollingTasks.set(submitId, entry);

  async function doPoll() {
    if (entry.cancelled) return;

    const result = await callDreamina(['query_result', '--submit_id=' + submitId], 30000);

    if (entry.cancelled) return;

    if (!result.success) {
      console.warn(`[轮询] 查询失败: ${result.error}`);
      entry.timer = setTimeout(doPoll, POLL_INTERVAL_FALLBACK);
      return;
    }

    const data = parseCliJson(result.stdout);
    if (!data) {
      console.warn(`[轮询] JSON 解析失败: ${result.stdout.slice(0, 100)}`);
      entry.timer = setTimeout(doPoll, POLL_INTERVAL_FALLBACK);
      return;
    }

    const genStatus = data.gen_status || data.status || 'unknown';
    const queueInfo = data.queue_info || {};
    const queueIdx    = queueInfo.queue_idx    ?? -1;
    const queueLength = queueInfo.queue_length ?? 0;
    const queueStatus = queueInfo.queue_status || '';
    console.log(`[轮询] submit_id=${submitId} gen_status=${genStatus} queue_status=${queueStatus} queue_idx=${queueIdx}`);

    if (genStatus === 'success' || genStatus === 'failed') {
      stopPolling(submitId);

      if (genStatus === 'success') {
        const downloadDir = task.downloadDir || settings.downloadDir;

        if (!settings.autoDownload) {
          console.log(`[下载] 自动下载已关闭，submit_id=${submitId} 标记为 completed，等待手动下载`);
          sendToRenderer('task:progress', {
            event: 'result',
            data: { submitId, prompt: task.prompt, status: 'completed', filePath: '', downloadDir, downloaded: false },
          });
          sendTaskNotification(task);
          return;
        }

        try { fs.mkdirSync(downloadDir, { recursive: true }); } catch {}

        const downloadResult = await callDreamina([
          'query_result',
          '--submit_id=' + submitId,
          '--download_dir=' + downloadDir,
        ], 60000);

        if (downloadResult.success) {
          const downloadData = parseCliJson(downloadResult.stdout);
          let filePath = downloadData?.download_path || downloadData?.file_path || '';

          if (!filePath || !fs.existsSync(filePath)) {
            console.warn(`[下载] filePath 为空或文件不存在: "${filePath}"，尝试在目录中查找`);
            try {
              const files = fs.readdirSync(downloadDir)
                .filter(f => /\.(mp4|mov|webm)$/i.test(f))
                .map(f => ({ name: f, mtime: fs.statSync(path.join(downloadDir, f)).mtimeMs }))
                .sort((a, b) => b.mtime - a.mtime);
              if (files.length > 0) {
                filePath = path.join(downloadDir, files[0].name);
                console.log(`[下载] 找到最新视频: ${filePath}`);
              }
            } catch (e) {
              console.warn('[下载] 扫描目录失败:', e.message);
            }
          }

          // 重命名为可读文件名
          const desiredName = makeVideoName(task.prompt, task.model, task.duration);
          const desiredPath = path.join(downloadDir, desiredName);
          filePath = safeRename(filePath, desiredPath);

          console.log(`[下载] 完成 filePath="${filePath}" downloadDir="${downloadDir}"`);
          sendToRenderer('task:progress', {
            event: 'result',
            data: { submitId, prompt: task.prompt, status: 'completed', filePath, downloadDir, downloaded: true },
          });
          sendTaskNotification(task);
        } else {
          console.warn(`[下载] 失败: ${downloadResult.error}`);
          sendToRenderer('task:progress', {
            event: 'result',
            data: { submitId, prompt: task.prompt, status: 'completed', filePath: '', downloadDir, downloadError: downloadResult.error, downloaded: false },
          });
        }
      } else {
        sendToRenderer('task:progress', {
          event: 'failed',
          data: { submitId, error: data.error || '生成失败' },
        });
      }
    } else {
      if (queueStatus === 'Queuing') {
        const nextPollAt = Date.now() + POLL_INTERVAL_QUEUED;
        sendToRenderer('task:progress', {
          event: 'queued',
          data: { submitId, queuePosition: queueIdx, queueLength, queueStatus, nextPollAt },
        });
        entry.timer = setTimeout(doPoll, POLL_INTERVAL_QUEUED);
        return;
      }

      sendToRenderer('task:progress', {
        event: 'progress',
        data: {
          submitId,
          progress: 50,
          queueStatus,
          message: queueStatus === 'Generating' ? '正在生成...' : '处理中...',
        },
      });
      entry.timer = setTimeout(doPoll, POLL_INTERVAL_FALLBACK);
    }
  }

  entry.timer = setTimeout(doPoll, POLL_INTERVAL_INITIAL);
}

function stopPolling(submitId) {
  const entry = pollingTasks.get(submitId);
  if (entry) {
    entry.cancelled = true;
    clearTimeout(entry.timer);
    pollingTasks.delete(submitId);
    console.log(`[轮询] 停止轮询 submit_id=${submitId}`);
  }
}

// ===== IPC Handlers =====
function registerIpcHandlers() {

  // ---- 登录（CLI 方式，spawn 实时监听 QR 码）----
  ipcMain.handle('auth:login', async () => {
    console.log('[登录] 开始 headless 登录...');
    sendToRenderer('task:progress', { event: 'login-start', data: { message: '正在启动登录...' } });
    
    return new Promise((resolve) => {
      const child = spawn(DREAMINA_BIN, ['login', '--headless'], {
        cwd: path.dirname(DREAMINA_BIN),
        env: { ...process.env },
      });
      
      let stdout = '';
      let stderr = '';
      let qrPath = null;
      
      child.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        console.log('[登录 CLI]', text.trim());
        
        // 检测 QR 码路径
        const qrMatch = text.match(/\[DREAMINA:QR_READY\]\s*(.+.png)/);
        if (qrMatch) {
          qrPath = qrMatch[1].trim();
          console.log('[登录] QR 码路径:', qrPath);
          
          // 读取图片并转成 base64
          try {
            const qrBuffer = fs.readFileSync(qrPath);
            const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;
            sendToRenderer('task:progress', { 
              event: 'login-qr-ready', 
              data: { qrBase64 } 
            });
          } catch (err) {
            console.error('[登录] 读取 QR 码失败:', err.message);
            sendToRenderer('task:progress', { 
              event: 'login-qr-error', 
              data: { error: '二维码加载失败' } 
            });
          }
        }
        
        // 检测登录成功
        if (text.includes('"login_success":true') || text.includes('LOGIN_SUCCESS')) {
          console.log('[登录] ✅ 登录成功');
          const sent = sendToRenderer('task:progress', { event: 'login-success', data: { message: '登录成功' } });
          console.log('[登录] sendToRenderer 返回:', sent);
          resolve({ success: true });
        }
        
        // 检测登录复用（已有登录态）
        if (text.includes('LOGIN_REUSED')) {
          console.log('[登录] ✅ 复用已有登录态');
          sendToRenderer('task:progress', { event: 'login-success', data: { message: '已登录' } });
          resolve({ success: true, reused: true });
        }
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout.includes('login_success')) {
          // 已在上面处理
        } else if (code !== 0) {
          console.warn('[登录] ❌ 登录失败:', stderr || stdout);
          sendToRenderer('task:progress', { event: 'login-failed', data: { error: stderr || '登录失败' } });
          resolve({ success: false, error: stderr || '登录失败' });
        }
      });
      
      // 超时保护
      setTimeout(() => {
        if (!child.killed) {
          child.kill();
          resolve({ success: false, error: '登录超时' });
        }
      }, 120000);
    });
  });

  ipcMain.handle('auth:relogin', async () => {
    console.log('[登录] 开始重新登录...');
    const result = await callDreamina(['relogin', '--headless'], 60000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      return { success: data?.login_success || false };
    }
    return { success: false, error: result.error };
  });

  ipcMain.handle('auth:logout', async () => {
    console.log('[登出] 清除本地登录态...');
    const result = await callDreamina(['logout'], 10000);
    return { success: result.success, message: '已清除登录态' };
  });

  // ---- 积分查询（CLI 方式，验证登录态）----
  ipcMain.handle('account:credits', async () => {
    const result = await callDreamina(['user_credit'], 15000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      if (data && data.total_credit !== undefined) {
        // 成功获取积分 = 已登录
        return {
          success: true,
          isLoggedIn: true,
          credits: data.total_credit || 0,
          data: {
            vipCredit: data.vip_credit || 0,
            giftCredit: data.gift_credit || 0,
            purchaseCredit: data.purchase_credit || 0,
            totalCredit: data.total_credit || 0,
          },
        };
      }
    }
    // 积分查询失败 = 未登录或网络问题
    return { success: false, isLoggedIn: false, error: result.error || '未登录' };
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
      return {
        success: true,
        task: { prompt: input, duration: 5, aspectRatio: '16:9', type: 'video' },
      };
    }
  });

  // ---- Seedance 模式任务准备（带素材） ----
  ipcMain.handle('task:prepare-seedance', async (_event, { input, materials }) => {
    console.log('[Seedance准备] 输入:', input?.slice?.(0, 80));
    console.log('[Seedance准备] 素材:', materials ? `${materials.images?.length || 0}图 ${materials.videos?.length || 0}视频` : '无');

    try {
      const ai = ensureAIService();
      const task = await ai.rewritePromptForSeedance(input, materials);
      return { success: true, task, materials };
    } catch (err) {
      console.error('[Seedance准备] 失败:', err.message);
      return {
        success: true,
        task: { prompt: input, duration: 5, aspectRatio: '16:9' },
        materials,
      };
    }
  });

  // ---- 批量任务生成 ----
  ipcMain.handle('task:prepare-batch', async (_event, payload) => {
    const input = typeof payload === 'string' ? payload : (payload?.input || '');
    const materials = (typeof payload === 'object' && payload?.materials) || { images: [], videos: [], audios: [] };
    const defaults = (typeof payload === 'object' && payload?.defaults) || {};
    console.log('[批量准备] 输入:', input?.slice?.(0, 100), '素材:', JSON.stringify(materials).slice(0, 100));

    try {
      const ai = ensureAIService();
      const result = await ai.generateBatchTasks(input, materials, defaults);
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

  // ---- 任务执行（无素材，CLI text2video）----
  ipcMain.handle('task:execute', async (_event, task) => {
    console.log('[执行任务] 任务:', JSON.stringify(task).slice(0, 200));

    const prompt = task.prompt || '';
    const duration = task.duration || 5;
    const ratio = task.aspectRatio || task.ratio || '9:16';
    const model = task.model || 'seedance2.0fast';

    sendToRenderer('task:progress', { event: 'progress', data: { progressType: 'submitting', message: '正在提交任务...' } });

    const args = [
      'text2video',
      '--prompt=' + prompt,
      '--duration=' + duration,
      '--ratio=' + ratio,
      '--model_version=' + model,
    ];

    console.log('[CLI] 执行:', args.join(' '));
    const result = await callDreamina(args, 30000);

    if (!result.success) {
      console.error('[执行任务] CLI 失败:', result.error);
      return { success: false, error: result.error };
    }

    const data = parseCliJson(result.stdout);
    if (!data || !data.submit_id) {
      console.error('[执行任务] 无 submit_id:', result.stdout.slice(0, 200));
      return { success: false, error: 'CLI 未返回 submit_id' };
    }

    const submitId = data.submit_id;
    console.log('[执行任务] ✅ submit_id:', submitId);

    // 开始轮询
    startPolling(submitId, { prompt, model, duration, downloadDir: settings.downloadDir });

    return {
      success: true,
      submitId,
      prompt,
      message: '任务已提交',
    };
  });

  // ---- 任务执行（有素材，CLI multimodal2video）----
  ipcMain.handle('task:execute-with-materials', async (_event, { task, materials }) => {
    console.log('[执行任务(有素材)] 任务:', JSON.stringify(task).slice(0, 100));
    console.log('[执行任务(有素材)] 素材:', materials?.length || 0, '个');

    const prompt = task.prompt || '';
    const duration = task.duration || 5;
    const ratio = task.aspectRatio || task.ratio || '9:16';
    const model = task.model || 'seedance2.0fast';

    sendToRenderer('task:progress', { event: 'progress', data: { progressType: 'submitting', message: '正在提交任务...' } });

    // 构造素材参数
    const args = ['multimodal2video', '--prompt=' + prompt, '--duration=' + duration, '--ratio=' + ratio, '--model_version=' + model];

    // 添加素材文件路径（image≤9, video≤3, audio≤3）
    if (materials && materials.length > 0) {
      const images = materials.filter(m => m.type === 'image').slice(0, 9);
      const videos = materials.filter(m => m.type === 'video').slice(0, 3);
      const audios = materials.filter(m => m.type === 'audio').slice(0, 3);

      images.forEach(img => args.push('--image=' + img.path));
      videos.forEach(vid => args.push('--video=' + vid.path));
      audios.forEach(aud => args.push('--audio=' + aud.path));
    }

    console.log('[CLI] 执行:', args.join(' '));
    const result = await callDreamina(args, 60000); // 有素材上传可能更慢

    if (!result.success) {
      console.error('[执行任务(有素材)] CLI 失败:', result.error);
      return { success: false, error: result.error };
    }

    const data = parseCliJson(result.stdout);
    if (!data || !data.submit_id) {
      console.error('[执行任务(有素材)] 无 submit_id:', result.stdout.slice(0, 200));
      return { success: false, error: 'CLI 未返回 submit_id' };
    }

    const submitId = data.submit_id;
    console.log('[执行任务(有素材)] ✅ submit_id:', submitId);

    // 开始轮询
    startPolling(submitId, { prompt, model, duration, downloadDir: settings.downloadDir, materials });

    return {
      success: true,
      submitId,
      prompt,
      message: '任务已提交',
    };
  });

  // ---- automation:run-structured alias (renderer calls runStructuredTask → this channel) ----
  ipcMain.handle('automation:run-structured', async (_event, params) => {
    const prompt = params.prompt || '';
    const duration = params.duration || 5;
    const ratio = params.aspectRatio || params.ratio || '9:16';
    const model = params.model || 'seedance2.0fast';
    const materials = params.materials || [];

    console.log('[run-structured] prompt:', prompt.slice(0, 80), '素材:', materials.length);
    sendToRenderer('task:progress', { event: 'progress', data: { progressType: 'submitting', message: '正在提交任务...' } });

    const args = ['multimodal2video', '--prompt=' + prompt, '--duration=' + duration, '--ratio=' + ratio, '--model_version=' + model];
    const images = materials.filter(m => m.type === 'image').slice(0, 9);
    const videos = materials.filter(m => m.type === 'video').slice(0, 3);
    const audios = materials.filter(m => m.type === 'audio').slice(0, 3);
    images.forEach(m => args.push('--image=' + m.path));
    videos.forEach(m => args.push('--video=' + m.path));
    audios.forEach(m => args.push('--audio=' + m.path));

    const result = await callDreamina(args, 60000);
    if (!result.success) return { success: false, error: result.error };

    const data = parseCliJson(result.stdout);
    if (!data || !data.submit_id) return { success: false, error: 'CLI 未返回 submit_id' };

    const submitId = data.submit_id;
    startPolling(submitId, { prompt, model, duration, downloadDir: settings.downloadDir, materials });
    return { success: true, submitId, prompt, message: '任务已提交' };
  });

  // ---- 历史列表查询 ----
  ipcMain.handle('task:list', async (_event, { limit, status } = {}) => {
    const args = ['list_task'];
    if (limit) args.push('--limit=' + limit);
    if (status) args.push('--gen_status=' + status);

    const result = await callDreamina(args, 30000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      return { success: true, tasks: data?.tasks || data || [] };
    }
    return { success: false, error: result.error };
  });

  // ---- 单个任务状态查询 ----
  ipcMain.handle('task:query', async (_event, submitId) => {
    const result = await callDreamina(['query_result', '--submit_id=' + submitId], 30000);
    
    if (result.success) {
      const data = parseCliJson(result.stdout);
      return { success: true, data };
    }
    return { success: false, error: result.error };
  });

  // ---- 手动下载 ----
  ipcMain.handle('task:download', async (_event, payload = {}) => {
    const { submitId, downloadDir, url, prompt, model, duration } = payload;
    const baseDir = downloadDir || settings.downloadDir;

    if (submitId) {
      const dir = baseDir;
      const result = await callDreamina(['query_result', '--submit_id=' + submitId, '--download_dir=' + dir], 60000);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const data = parseCliJson(result.stdout);
      let filePath = data?.download_path || data?.file_path || '';
      if (!filePath || !fs.existsSync(filePath)) {
        try {
          const files = fs.readdirSync(dir)
            .filter(f => /\.(mp4|mov|webm)$/i.test(f))
            .map(f => ({ name: f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
            .sort((a, b) => b.mtime - a.mtime);
          if (files.length > 0) {
            filePath = path.join(dir, files[0].name);
          }
        } catch (e) {
          console.warn('[手动下载] 扫描目录失败:', e.message);
        }
      }

      if (!filePath || !fs.existsSync(filePath)) {
        return { success: false, error: '下载完成但未找到文件' };
      }

      if (prompt) {
        const desiredPath = path.join(dir, makeVideoName(prompt, model || 'seedance2.0fast', duration || 5));
        filePath = safeRename(filePath, desiredPath);
      }

      return { success: true, filePath, downloadDir: dir };
    }

    if (isRemoteHttpUrl(url)) {
      const dir = model === 'kling-o1' ? path.join(baseDir, '可灵O1') : baseDir;
      const desiredPath = path.join(dir, makeVideoName(prompt || '视频', model || 'manual', duration || 5));
      const tempPath = path.join(
        dir,
        `.__vidclaw_downloading_${Date.now()}_${Math.random().toString(16).slice(2)}${path.extname(desiredPath) || '.mp4'}`
      );
      try {
        await downloadRemoteVideo(url, tempPath);
        const filePath = safeRename(tempPath, desiredPath);
        return { success: true, filePath, downloadDir: dir };
      } catch (err) {
        try { fs.unlinkSync(tempPath); } catch {}
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: '缺少可用的下载来源' };
  });

  // ---- 选择文件 ----
  ipcMain.handle('file:select', async () => {
    if (!mainWindow) return { files: [] };
    // No dialog-level filter — macOS UTI mapping for audio extensions is
    // unreliable and greys out valid files. Format + size validation is
    // handled entirely in the renderer.
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择素材文件',
      properties: ['openFile', 'multiSelections'],
    });
    if (result.canceled) return { files: [] };
    return { files: result.filePaths };
  });

  // ---- 获取文件大小 (for renderer-side validation) ----
  ipcMain.handle('file:stat', async (_event, filePath) => {
    try {
      const stat = require('fs').statSync(filePath);
      return { size: stat.size };
    } catch {
      return { size: 0 };
    }
  });

  ipcMain.handle('file:server-port', () => localFileServerPort);

  // ── 邮箱登录（内测鉴权）──────────────────────────────────────────
  // 白名单后缀：@miaoboai.com → 内部用户，赠送 99999 积分
  const INTERNAL_DOMAINS = ['miaoboai.com'];
  ipcMain.handle('auth:email-login', async (_event, email) => {
    if (!email || typeof email !== 'string') {
      return { success: false, error: '请输入邮箱地址' };
    }
    const normalized = email.trim().toLowerCase();
    const domainMatch = normalized.match(/@(.+)$/);
    if (!domainMatch) return { success: false, error: '邮箱格式不正确' };
    const domain = domainMatch[1];
    const isInternal = INTERNAL_DOMAINS.includes(domain);
    if (!isInternal) {
      return { success: false, error: '此邮箱后缀不在内测名单，请使用公司邮箱（@miaoboai.com）' };
    }
    return { success: true, isInternal, email: normalized };
  });

  // ── 可灵 O1 图生视频（Coze API）── 并发队列（最多 5 并发）──────────
  const { klingGenerate } = require('./coze');
  const klingQueue = [];          // { taskFn, submitId }[]
  let klingRunning = 0;
  const KLING_MAX_CONCURRENT = 5;

  function drainKlingQueue() {
    while (klingRunning < KLING_MAX_CONCURRENT && klingQueue.length > 0) {
      klingRunning++;
      const { taskFn } = klingQueue.shift();
      taskFn().finally(() => {
        klingRunning--;
        drainKlingQueue();
      });
    }
  }

  ipcMain.handle('kling:generate', (_event, { imagePaths, prompt, duration, aspectRatio, submitId: clientSubmitId }) => {
    const submitId = clientSubmitId || 'kling_' + Date.now();
    const downloadDir = path.join(settings.downloadDir || path.join(require('os').homedir(), 'Downloads', '即梦'), '可灵O1');

    function sendKlingProgress(stage, message, progress) {
      sendToRenderer('task:progress', {
        event: 'kling-progress',
        data: { submitId, stage, message, progress },
      });
    }

    async function runThisTask() {
      console.log('[Kling] 开始生成，图片数:', imagePaths?.length, '时长:', duration, '比例:', aspectRatio);
      sendKlingProgress('upload', `上传图片 (共 ${imagePaths.length} 张)...`, 5);
      let uploadedCount = 0;
      const totalImages = imagePaths.length;
      try {
        const result = await klingGenerate(
          { imagePaths, prompt, duration, aspectRatio, downloadDir },
          (msg) => {
            if (msg.includes('上传图片') || msg.includes('上传完成')) {
              uploadedCount++;
              const pct = 5 + Math.round((uploadedCount / totalImages) * 20);
              sendKlingProgress('upload', msg, Math.min(pct, 25));
            } else if (msg.includes('已提交') || msg.includes('等待生成')) {
              sendKlingProgress('submitted', msg, 30);
            } else if (msg.includes('下载')) {
              sendKlingProgress('downloading', msg, 90);
            } else {
              sendKlingProgress('generating', msg, 30);
            }
          }
        );
        if (result.success) {
          sendToRenderer('task:progress', {
            event: 'result',
            data: { submitId, status: 'completed', filePath: result.localPath || '', resultUrl: result.videoUrl, downloadDir, prompt },
          });
        } else {
          sendToRenderer('task:progress', {
            event: 'failed',
            data: { submitId, error: result.error },
          });
        }
      } catch (err) {
        console.error('[Kling] 生成异常:', err);
        sendToRenderer('task:progress', {
          event: 'failed',
          data: { submitId, error: err.message },
        });
      }
    }

    if (klingRunning < KLING_MAX_CONCURRENT) {
      // 有空位，立即执行
      klingRunning++;
      setImmediate(() => {
        runThisTask().finally(() => {
          klingRunning--;
          drainKlingQueue();
        });
      });
    } else {
      // 队列已满，进入等待队列并通知渲染进程
      const queuePosition = klingQueue.length + 1;
      klingQueue.push({ taskFn: runThisTask, submitId });
      sendKlingProgress('queued', `排队中 第${queuePosition}位`, 0);
      console.log(`[Kling] 任务 ${submitId} 进入队列，当前位置: ${queuePosition}`);
    }

    // Return immediately so renderer can unlock input right away
    return { success: true, submitId };
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
    return {
      version: app.getVersion(),
      downloadDir: settings.downloadDir,
      cliPath: DREAMINA_BIN,
      pollingTasks: pollingTasks.size,
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

  // ---- 打开单个文件 ----
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

  // ---- 任务完成通知 ----
  ipcMain.handle('task:notify', async (_event, task) => {
    sendTaskNotification(task);
    return { success: true };
  });

  // ═══════════════════════════════════════════
  // 批量任务 API（改用 CLI）
  // ═══════════════════════════════════════════

  const { BatchTaskManager } = require('./services/batch-task-manager');
  let batchTaskManager = null;

  function ensureBatchTaskManager() {
    if (!batchTaskManager) {
      batchTaskManager = new BatchTaskManager(DREAMINA_BIN, settings.downloadDir);
      batchTaskManager.setOnCompleteCallback((summary) => {
        sendToRenderer('task:progress', {
          event: 'batch-complete',
          data: summary,
        });
        sendBatchCompleteNotification(summary);
      });
      batchTaskManager.setOnTaskUpdateCallback((task) => {
        sendToRenderer('task:progress', {
          event: 'batch-task-update',
          data: task,
        });
      });
    }
    return batchTaskManager;
  }

  ipcMain.handle('batch:create', async (_event, { batch, tasks }) => {
    try {
      const manager = ensureBatchTaskManager();
      return manager.createBatch(batch, tasks);
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:start', async () => {
    try {
      const manager = ensureBatchTaskManager();
      return manager.start();
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:stop', async () => {
    try {
      const manager = ensureBatchTaskManager();
      manager.stop();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:status', async () => {
    try {
      const manager = ensureBatchTaskManager();
      return { success: true, ...manager.getStatus() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:delete-task', async (_event, { taskId }) => {
    try {
      const manager = ensureBatchTaskManager();
      manager.deleteTask(taskId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('batch:update-task', async (_event, { taskId, updates }) => {
    try {
      const manager = ensureBatchTaskManager();
      manager.updateTask(taskId, updates);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

// ===== 启动 =====
if (gotTheLock) {
  app.whenReady().then(async () => {
    // Start local file HTTP server — used by renderer to load local media files.
    // Replaces the custom local-file:// protocol which has a confirmed unfixed bug
    // in Electron 37+ (issue #38749): Range requests never work, so video seeking
    // and thumbnail canvas capture are broken. A plain HTTP server on 127.0.0.1
    // handles Range requests natively and works with any Electron version.
    await startLocalFileServer();

    // IPC handlers first — must not be blocked by protocol setup failures
    registerIpcHandlers();

    // local-file:// protocol — serves local media with full byte-range support.
    // net.fetch('file://...') is broken for range requests in Electron 37+
    // (electron/electron#38749, still open as of Electron 41). We implement
    // range handling manually with fs.createReadStream so <video> can seek
    // and canvas.drawImage can capture frames for thumbnails.
    // MUST use session.defaultSession.protocol.handle (not module-level protocol.handle)
    // for range requests to work in Electron 37+ — confirmed fix from issue #38749.
    // Wrapped in try/catch so a "scheme already registered" error on hot-reload
    // does not abort startup (IPC handlers are registered before this).
    try {
      const MIME_TYPES = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png',  '.webp': 'image/webp',
        '.mp4': 'video/mp4',  '.mov': 'video/quicktime',
        '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
        '.aac': 'audio/aac',  '.m4a': 'audio/mp4',
      };
      session.defaultSession.protocol.handle('local-file', (request) => {
        try {
          const filePath = decodeURIComponent(request.url.slice('local-file://'.length));
          if (!fs.existsSync(filePath)) {
            return new Response('File not found', { status: 404 });
          }
          const stat = fs.statSync(filePath);
          const fileSize = stat.size;
          const ext = path.extname(filePath).toLowerCase();
          const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
          const rangeHeader = request.headers.get('range');

          if (rangeHeader) {
            const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
            if (match) {
              const start = parseInt(match[1], 10);
              const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
              if (start >= fileSize || end >= fileSize) {
                return new Response(null, {
                  status: 416,
                  headers: { 'Content-Range': `bytes */${fileSize}` },
                });
              }
              const chunkSize = end - start + 1;
              const stream = fs.createReadStream(filePath, { start, end });
              return new Response(stream, {
                status: 206,
                headers: {
                  'Content-Type': mimeType,
                  'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                  'Content-Length': String(chunkSize),
                  'Accept-Ranges': 'bytes',
                },
              });
            }
          }
          // Non-range request — return full file
          const stream = fs.createReadStream(filePath);
          return new Response(stream, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': String(fileSize),
              'Accept-Ranges': 'bytes',
            },
          });
        } catch (err) {
          console.error('[Protocol] local-file error:', err.message);
          return new Response('Internal Server Error', { status: 500 });
        }
      });
    } catch (e) {
      console.warn('[Protocol] local-file:// handler registration skipped (already registered):', e.message);
    }

    await createWindow();
  });

  app.on('window-all-closed', async () => {
    // 停止所有轮询
    for (const [submitId, entry] of pollingTasks) {
      clearInterval(entry.timer);
    }
    pollingTasks.clear();
    
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
}
