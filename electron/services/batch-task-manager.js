/**
 * 批量任务管理器（CLI 版本）
 * 
 * 功能：
 * 1. 管理批量任务队列
 * 2. 自动补位（即梦最多5个并发）
 * 3. 状态监控（通过 CLI query_result）
 * 4. 自动下载和命名
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

// 批量任务状态
const BatchTaskStatus = {
  PENDING: 'pending',       // 等待执行
  SUBMITTED: 'submitted',   // 已提交到即梦
  GENERATING: 'generating', // 生成中
  COMPLETED: 'completed',   // 已完成
  DOWNLOADED: 'downloaded', // 已下载
  FAILED: 'failed',         // 失败
};

// 批量任务上限
const MAX_BATCH_TASKS = 20;
// 即梦并发上限
const MAX_CONCURRENT_JIMENG = 5;

class BatchTaskManager {
  constructor(dreaminaBin, downloadDir) {
    this.dreaminaBin = dreaminaBin;
    this.downloadDir = downloadDir;
    this.tasks = [];
    this.running = false;
    this.monitorInterval = null;
    this.currentBatchId = null;
    this.batchMetadata = null;
    this.pollingTimers = new Map(); // submitId -> timer
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // 恢复未完成的任务
    this._loadPersistedTasks();
  }

  /**
   * 调用即梦 CLI
   */
  async _callCli(args, timeout = 30000) {
    try {
      const { stdout, stderr } = await execFileAsync(this.dreaminaBin, args, { timeout });
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
      return { success: false, error: err.stderr || err.message };
    }
  }

  /**
   * 解析 CLI JSON 输出
   */
  _parseJson(stdout) {
    try {
      return JSON.parse(stdout);
    } catch {
      return null;
    }
  }

  /**
   * 创建批量任务
   */
  createBatch(batch, tasks) {
    if (tasks.length > MAX_BATCH_TASKS) {
      return { success: false, error: `批量任务上限为 ${MAX_BATCH_TASKS} 个` };
    }

    const batchId = batch.id || `batch_${Date.now()}`;
    const batchDir = path.join(this.downloadDir, batch.name || batchId);
    
    // 创建批次目录
    if (!fs.existsSync(batchDir)) {
      fs.mkdirSync(batchDir, { recursive: true });
    }

    // 初始化任务
    const enrichedTasks = tasks.map((task, index) => ({
      id: `${batchId}_task_${index + 1}`,
      batchId,
      index: index + 1,
      status: BatchTaskStatus.PENDING,
      submitId: null,
      prompt: task.prompt,
      reason: task.reason,
      materials: task.materials || [],
      expectedEffect: task.expectedEffect || '',
      duration: task.duration || 5,
      aspectRatio: task.aspectRatio || '16:9',
      model: task.model || 'seedance2.0fast',
      outputFile: null,
      error: null,
      createdAt: new Date().toISOString(),
    }));

    // 批次元信息
    this.batchMetadata = {
      id: batchId,
      name: batch.name || batchId,
      description: batch.description || '',
      totalTasks: tasks.length,
      completedTasks: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
      downloadDir: batchDir,
    };

    this.tasks = enrichedTasks;
    this._persistTasks();

    console.log(`[批量任务] 创建批次 ${batchId}，共 ${tasks.length} 个任务`);

    return {
      success: true,
      batchId,
      totalTasks: tasks.length,
      tasks: enrichedTasks,
    };
  }

  /**
   * 开始执行批量任务
   */
  async start() {
    if (this.running) {
      return { success: false, error: '批量任务已在运行中' };
    }

    this.running = true;
    console.log('[批量任务] 开始执行');

    // 启动监控
    this._startMonitor();

    // 开始提交任务
    await this._submitNextTask();

    return { success: true };
  }

  /**
   * 停止批量任务
   */
  stop() {
    this.running = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    // 停止所有轮询
    for (const [submitId, timer] of this.pollingTimers) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();
    console.log('[批量任务] 已停止');
  }

  /**
   * 获取批量任务状态
   */
  getStatus() {
    const statusCounts = {};
    Object.values(BatchTaskStatus).forEach(s => statusCounts[s] = 0);
    this.tasks.forEach(t => statusCounts[t.status]++);

    return {
      batch: this.batchMetadata,
      tasks: this.tasks,
      statusCounts,
      running: this.running,
    };
  }

  /**
   * 启动状态监控
   */
  _startMonitor() {
    // 每 10 秒检查一次状态
    this.monitorInterval = setInterval(async () => {
      if (!this.running) return;

      try {
        await this._checkTaskStatus();
      } catch (e) {
        console.error('[批量任务] 监控出错:', e.message);
      }
    }, 10000);

    console.log('[批量任务] 监控已启动');
  }

  /**
   * 检查任务状态
   */
  async _checkTaskStatus() {
    // 获取当前正在生成/已提交的任务
    const activeTasks = this.tasks.filter(
      t => t.status === BatchTaskStatus.SUBMITTED || t.status === BatchTaskStatus.GENERATING
    );

    // 如果活跃任务数 < 5，提交下一个
    if (activeTasks.length < MAX_CONCURRENT_JIMENG) {
      await this._submitNextTask();
    }
  }

  /**
   * 提交下一个待执行任务
   */
  async _submitNextTask() {
    const pendingTask = this.tasks.find(t => t.status === BatchTaskStatus.PENDING);
    if (!pendingTask) {
      // 所有任务已执行
      const allDone = this.tasks.every(
        t => t.status === BatchTaskStatus.COMPLETED
          || t.status === BatchTaskStatus.DOWNLOADED
          || t.status === BatchTaskStatus.FAILED
      );
      if (allDone && this.running) {
        console.log('[批量任务] 所有任务已执行完毕');
        this._onBatchComplete();
      }
      return;
    }

    console.log(`[批量任务] 提交任务 ${pendingTask.index}/${this.tasks.length}`);

    try {
      pendingTask.status = BatchTaskStatus.SUBMITTED;
      this._persistTasks();
      this._notifyTaskUpdate(pendingTask);

      // 构造 CLI 参数
      let args;
      const hasMaterials = pendingTask.materials && pendingTask.materials.length > 0;

      if (hasMaterials) {
        // multimodal2video
        args = [
          'multimodal2video',
          '--prompt=' + pendingTask.prompt,
          '--duration=' + pendingTask.duration,
          '--ratio=' + pendingTask.aspectRatio,
          '--model_version=' + pendingTask.model,
        ];

        // 添加素材（image≤9, video≤3, audio≤3）
        const images = pendingTask.materials.filter(m => m.type === 'image').slice(0, 9);
        const videos = pendingTask.materials.filter(m => m.type === 'video').slice(0, 3);
        const audios = pendingTask.materials.filter(m => m.type === 'audio').slice(0, 3);
        images.forEach(img => args.push('--image=' + img.path));
        videos.forEach(vid => args.push('--video=' + vid.path));
        audios.forEach(aud => args.push('--audio=' + aud.path));
      } else {
        // text2video
        args = [
          'text2video',
          '--prompt=' + pendingTask.prompt,
          '--duration=' + pendingTask.duration,
          '--ratio=' + pendingTask.aspectRatio,
          '--model_version=' + pendingTask.model,
        ];
      }

      console.log('[批量任务] CLI:', args.join(' '));
      const result = await this._callCli(args, hasMaterials ? 60000 : 30000);

      if (!result.success) {
        pendingTask.status = BatchTaskStatus.FAILED;
        pendingTask.error = result.error;
        this._persistTasks();
        this._notifyTaskUpdate(pendingTask);
        console.log(`[批量任务] 任务 ${pendingTask.index} 失败: ${result.error}，跳过继续`);
        await this._submitNextTask();
        return;
      }

      const data = this._parseJson(result.stdout);
      if (!data || !data.submit_id) {
        pendingTask.status = BatchTaskStatus.FAILED;
        pendingTask.error = 'CLI 未返回 submit_id';
        this._persistTasks();
        this._notifyTaskUpdate(pendingTask);
        console.log(`[批量任务] 任务 ${pendingTask.index} 无 submit_id，跳过继续`);
        await this._submitNextTask();
        return;
      }

      pendingTask.submitId = data.submit_id;
      pendingTask.status = BatchTaskStatus.GENERATING;
      this._persistTasks();
      this._notifyTaskUpdate(pendingTask);
      
      // 开始轮询该任务
      this._startTaskPolling(pendingTask);
      
      console.log(`[批量任务] 任务 ${pendingTask.index} 已提交, submitId=${pendingTask.submitId}`);

    } catch (e) {
      pendingTask.status = BatchTaskStatus.FAILED;
      pendingTask.error = e.message;
      this._persistTasks();
      this._notifyTaskUpdate(pendingTask);
      console.log(`[批量任务] 任务 ${pendingTask.index} 异常: ${e.message}，跳过继续`);
      await this._submitNextTask();
    }
  }

  /**
   * 开始轮询单个任务
   */
  _startTaskPolling(task) {
    if (this.pollingTimers.has(task.submitId)) return;

    const timer = setInterval(async () => {
      try {
        const result = await this._callCli(['query_result', '--submit_id=' + task.submitId], 30000);
        
        if (!result.success) {
          console.warn(`[批量任务轮询] 查询失败: ${result.error}`);
          return;
        }

        const data = this._parseJson(result.stdout);
        if (!data) return;

        const status = data.gen_status || data.status || 'unknown';
        
        if (status === 'success') {
          clearInterval(timer);
          this.pollingTimers.delete(task.submitId);
          
          // 下载
          await this._downloadTask(task);
          
          // 继续下一个
          await this._submitNextTask();
        } else if (status === 'failed') {
          clearInterval(timer);
          this.pollingTimers.delete(task.submitId);

          task.status = BatchTaskStatus.FAILED;
          task.error = data.error || '生成失败';
          this._persistTasks();
          this._notifyTaskUpdate(task);

          await this._submitNextTask();
        }
      } catch (e) {
        console.error(`[批量任务轮询] 异常: ${e.message}`);
      }
    }, 5000);

    this.pollingTimers.set(task.submitId, timer);
  }

  /**
   * 下载任务结果
   */
  async _downloadTask(task) {
    try {
      const batchDir = this.batchMetadata?.downloadDir || this.downloadDir;
      const fileName = this._generateFileName(task);
      
      // CLI 下载到批次目录
      const result = await this._callCli([
        'query_result',
        '--submit_id=' + task.submitId,
        '--download_dir=' + batchDir,
      ], 60000);

      if (result.success) {
        const data = this._parseJson(result.stdout);
        // CLI 可能重命名文件，记录实际路径
        const actualPath = data?.download_path || path.join(batchDir, fileName);
        
        task.status = BatchTaskStatus.DOWNLOADED;
        task.outputFile = actualPath;
        this._persistTasks();
        this._notifyTaskUpdate(task);

        console.log(`[批量任务] 已下载: ${actualPath}`);
      } else {
        task.status = BatchTaskStatus.COMPLETED; // 下载失败但任务完成
        task.error = '下载失败: ' + result.error;
        this._persistTasks();
        this._notifyTaskUpdate(task);
      }
    } catch (e) {
      console.error(`[批量任务] 下载失败:`, e.message);
      task.error = '下载失败: ' + e.message;
      this._persistTasks();
    }
  }

  /**
   * 生成文件名
   */
  _generateFileName(task) {
    const index = String(task.index).padStart(2, '0');
    const testPoint = (task.reason || '测试')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      .slice(0, 20);
    const materialDesc = task.materials?.length > 0
      ? `${task.materials.length}素材`
      : '无素材';
    return `${index}_${testPoint}_${materialDesc}.mp4`;
  }

  /**
   * 批次完成处理
   */
  _onBatchComplete() {
    this.running = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    // 停止所有轮询
    for (const [submitId, timer] of this.pollingTimers) {
      clearInterval(timer);
    }
    this.pollingTimers.clear();

    if (this.batchMetadata) {
      this.batchMetadata.status = 'completed';
      this.batchMetadata.completedAt = new Date().toISOString();
    }

    const succeeded = this.tasks.filter(
      t => t.status === BatchTaskStatus.COMPLETED || t.status === BatchTaskStatus.DOWNLOADED
    ).length;
    const failed = this.tasks.filter(t => t.status === BatchTaskStatus.FAILED).length;

    console.log(`[批量任务] 批次完成: ${this.batchMetadata?.name}`);
    console.log(`[批量任务] 结果: ${succeeded} 成功 / ${failed} 失败`);
    console.log(`[批量任务] 文件保存在: ${this.batchMetadata?.downloadDir}`);

    if (this._onCompleteCallback) {
      this._onCompleteCallback({
        batch: this.batchMetadata,
        tasks: this.tasks,
        succeeded,
        failed,
        total: this.tasks.length,
      });
    }

    this._saveBatchSummary();
  }

  /**
   * 删除任务（仅 pending/failed 状态可删）
   */
  deleteTask(taskId) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    const task = this.tasks[idx];
    // 停止该任务的轮询（如果有）
    if (task.submitId && this.pollingTimers.has(task.submitId)) {
      clearInterval(this.pollingTimers.get(task.submitId));
      this.pollingTimers.delete(task.submitId);
    }
    this.tasks.splice(idx, 1);
    this._persistTasks();
  }

  /**
   * 更新任务字段
   */
  updateTask(taskId, updates) {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) return;
    Object.assign(task, updates);
    this._persistTasks();
  }

  /**
   * 设置批次完成回调
   */
  setOnCompleteCallback(callback) {
    this._onCompleteCallback = callback;
  }

  /**
   * 设置单任务状态更新回调
   */
  setOnTaskUpdateCallback(callback) {
    this._onTaskUpdateCallback = callback;
  }

  /**
   * 通知单任务状态变化
   */
  _notifyTaskUpdate(task) {
    if (this._onTaskUpdateCallback) {
      this._onTaskUpdateCallback({ ...task });
    }
  }

  /**
   * 保存批次摘要
   */
  _saveBatchSummary() {
    if (!this.batchMetadata) return;

    const summary = {
      batch: this.batchMetadata,
      tasks: this.tasks.map(t => ({
        index: t.index,
        prompt: t.prompt,
        reason: t.reason,
        status: t.status,
        outputFile: t.outputFile,
        error: t.error,
      })),
    };

    const summaryPath = path.join(this.batchMetadata.downloadDir, '_batch_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`[批量任务] 摘要已保存: ${summaryPath}`);
  }

  /**
   * 持久化任务
   */
  _persistTasks() {
    const data = {
      batch: this.batchMetadata,
      tasks: this.tasks,
      running: this.running,
    };
    const persistPath = path.join(this.downloadDir, '_batch_tasks.json');
    fs.writeFileSync(persistPath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * 加载持久化任务
   */
  _loadPersistedTasks() {
    const persistPath = path.join(this.downloadDir, '_batch_tasks.json');
    if (fs.existsSync(persistPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(persistPath, 'utf8'));
        this.batchMetadata = data.batch;
        this.tasks = data.tasks || [];
        console.log(`[批量任务] 恢复 ${this.tasks.length} 个任务`);
      } catch (e) {
        console.error('[批量任务] 恢复任务失败:', e.message);
      }
    }
  }
}

module.exports = { BatchTaskManager, BatchTaskStatus, MAX_BATCH_TASKS, MAX_CONCURRENT_JIMENG };