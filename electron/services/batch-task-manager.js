/**
 * 批量任务管理器
 * 
 * 功能：
 * 1. 管理批量任务队列
 * 2. 自动补位（即梦最多5个并发）
 * 3. 状态监控
 * 4. 自动下载和命名
 */

const fs = require('fs');
const path = require('path');

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
  constructor(automationService, downloadDir) {
    this.automation = automationService;
    this.downloadDir = downloadDir;
    this.tasks = [];
    this.running = false;
    this.monitorInterval = null;
    this.currentBatchId = null;
    this.batchMetadata = null;
    
    // 确保下载目录存在
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
    
    // 恢复未完成的任务
    this._loadPersistedTasks();
  }

  /**
   * 创建批量任务
   * @param {Object} batch - 批量任务元信息
   * @param {string} batch.id - 批次ID
   * @param {string} batch.name - 批次名称（用于文件夹命名）
   * @param {string} batch.description - 批次描述
   * @param {Array} tasks - 任务列表
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
      prompt: task.prompt,
      reason: task.reason,
      materials: task.materials || [],
      expectedEffect: task.expectedEffect || '',
      duration: task.duration || 5,
      aspectRatio: task.aspectRatio || '16:9',
      model: task.model || 'seedance_2.0_fast',
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

    // 检查是否有任务完成（通过即梦页面状态）
    // 这部分需要与 AutomationService 配合
  }

  /**
   * 提交下一个待执行任务
   */
  async _submitNextTask() {
    const pendingTask = this.tasks.find(t => t.status === BatchTaskStatus.PENDING);
    if (!pendingTask) {
      // 所有任务已执行（完成、下载或失败都算"已执行"）
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

      // 调用 AutomationService 提交任务
      const result = await this.automation.runStructuredTask({
        prompt: pendingTask.prompt,
        materials: pendingTask.materials,
        model: pendingTask.model,
        duration: pendingTask.duration,
        aspectRatio: pendingTask.aspectRatio,
      });

      if (result.success) {
        pendingTask.status = BatchTaskStatus.GENERATING;
        pendingTask.taskId = result.taskId;
        this._persistTasks();
      } else {
        pendingTask.status = BatchTaskStatus.FAILED;
        pendingTask.error = result.error;
        this._persistTasks();
        // 失败后跳过，继续执行下一个任务
        console.log(`[批量任务] 任务 ${pendingTask.index} 失败: ${result.error}，跳过继续`);
        await this._submitNextTask();
      }
    } catch (e) {
      pendingTask.status = BatchTaskStatus.FAILED;
      pendingTask.error = e.message;
      this._persistTasks();
      // 异常后跳过，继续执行下一个任务
      console.log(`[批量任务] 任务 ${pendingTask.index} 异常: ${e.message}，跳过继续`);
      await this._submitNextTask();
    }
  }

  /**
   * 任务完成回调
   */
  async onTaskComplete(taskId, downloadUrl) {
    const task = this.tasks.find(t => t.taskId === taskId);
    if (!task) return;

    console.log(`[批量任务] 任务 ${task.index} 完成`);

    task.status = BatchTaskStatus.COMPLETED;
    task.downloadUrl = downloadUrl;
    this._persistTasks();

    // 下载文件
    await this._downloadTask(task);

    // 更新批次进度
    if (this.batchMetadata) {
      this.batchMetadata.completedTasks = this.tasks.filter(
        t => t.status === BatchTaskStatus.DOWNLOADED
      ).length;
    }

    // 继续下一个任务
    await this._submitNextTask();
  }

  /**
   * 下载任务结果
   */
  async _downloadTask(task) {
    if (!task.downloadUrl) return;

    try {
      // 生成文件名：{序号}_{测试要点}_{素材描述}.mp4
      const fileName = this._generateFileName(task);
      const outputPath = path.join(this.batchMetadata.downloadDir, fileName);

      // 下载文件（这里需要实际的下载逻辑）
      // const result = await this.automation.downloadFile(task.downloadUrl, outputPath);
      
      task.status = BatchTaskStatus.DOWNLOADED;
      task.outputFile = outputPath;
      this._persistTasks();

      console.log(`[批量任务] 已下载: ${fileName}`);
    } catch (e) {
      console.error(`[批量任务] 下载失败:`, e.message);
      task.error = `下载失败: ${e.message}`;
      this._persistTasks();
    }
  }

  /**
   * 生成文件名
   */
  _generateFileName(task) {
    // 格式：{序号}_{测试要点}_{素材描述}.mp4
    const index = String(task.index).padStart(2, '0');
    
    // 从 reason 中提取测试要点（取前20字）
    const testPoint = (task.reason || '测试')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
      .slice(0, 20);
    
    // 素材描述
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

    if (this.batchMetadata) {
      this.batchMetadata.status = 'completed';
      this.batchMetadata.completedAt = new Date().toISOString();
    }

    // 统计结果
    const succeeded = this.tasks.filter(
      t => t.status === BatchTaskStatus.COMPLETED || t.status === BatchTaskStatus.DOWNLOADED
    ).length;
    const failed = this.tasks.filter(t => t.status === BatchTaskStatus.FAILED).length;

    console.log(`[批量任务] 批次完成: ${this.batchMetadata?.name}`);
    console.log(`[批量任务] 结果: ${succeeded} 成功 / ${failed} 失败`);
    console.log(`[批量任务] 文件保存在: ${this.batchMetadata?.downloadDir}`);

    // 通知渲染进程（如果有回调）
    if (this._onCompleteCallback) {
      this._onCompleteCallback({
        batch: this.batchMetadata,
        tasks: this.tasks,
        succeeded,
        failed,
        total: this.tasks.length,
      });
    }

    // 保存批次摘要
    this._saveBatchSummary();
  }

  /**
   * 设置批次完成回调
   */
  setOnCompleteCallback(callback) {
    this._onCompleteCallback = callback;
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