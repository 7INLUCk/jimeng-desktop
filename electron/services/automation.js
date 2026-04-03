const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ===== 即梦 URL 常量 =====
const JIMENG_GENERATE_URL = 'https://jimeng.jianying.com/ai-tool/generate';
const JIMENG_HOME_URL = 'https://jimeng.jianying.com/ai-tool/home';

// ===== 模型配置 =====
const MODEL_MAP = {
  'seedance_2.0_fast': { key: 'dreamina_seedance_40', label: 'Seedance 2.0 Fast', benefit: 'dreamina_seedance_20_fast_with_video' },
  'seedance_2.0': { key: 'dreamina_seedance_20', label: 'Seedance 2.0', benefit: 'dreamina_seedance_20_with_video' },
};

const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];
// 即梦秒数范围：4-15秒（实测 UI 有 12 个选项，2026-04-01）
const VALID_DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// ===== 即梦 API 端点匹配 =====
function isJimengApi(url) {
  return url.includes('/mweb/v1/feed')
    || url.includes('/mweb/v1/get_explore')
    || url.includes('/mweb/v1/get_homepage')
    || url.includes('/mweb/v1/get_history')
    || url.includes('/mweb/v1/get_history_group')
    || url.includes('/mweb/v1/get_history_by_ids')
    || url.includes('/mweb/v1/get_item_info')
    || url.includes('/mweb/v1/get_asset_list');
}

function isCreditApi(url) {
  return url.includes('/commerce/v1/benefits/user_credit');
}

// ===== 工具函数 =====

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms + Math.random() * 300));
}

function randomDelay(min = 500, max = 2000) {
  return new Promise(r => setTimeout(r, Math.floor(Math.random() * (max - min + 1)) + min));
}

async function waitFor(condition, { timeout = 10000, interval = 300, errorMessage = '等待超时' } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      try {
        const result = condition();
        if (result) { clearInterval(timer); resolve(result); return; }
        if (Date.now() - start >= timeout) { clearInterval(timer); reject(new Error(errorMessage)); }
      } catch (e) { clearInterval(timer); reject(e); }
    }, interval);
  });
}

async function withRetry(fn, { retries = 2, stepName = '操作' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      if (attempt > 1) { console.log(`[${stepName}] 第${attempt}次重试`); await randomDelay(800, 1800); }
      return await fn(attempt);
    } catch (e) {
      lastError = e;
      console.log(`[${stepName}] 失败（第${attempt}次）:`, e.message);
      if (attempt > retries) break;
    }
  }
  throw lastError;
}

// ===== 纯数据处理函数（从 content.js 直接复用） =====

function getLargestUrl(urlMap) {
  if (!urlMap || typeof urlMap !== 'object') return '';
  const keys = Object.keys(urlMap).filter(k => /^\d+$/.test(k));
  if (keys.length === 0) return urlMap.origin || '';
  const largest = keys.reduce((a, b) => Number(a) > Number(b) ? a : b);
  return urlMap[largest] || '';
}

function getImageId(url) {
  return (url || '').match(/\/([0-9a-z]{32})/)?.[1] || '';
}

function parseItem(item) {
  const { image, video, common_attr, aigc_image_params } = item;
  const isVideo = !!video;
  const generateType = isVideo ? 'video' : 'image';

  let url = '';
  if (isVideo) {
    url = video?.origin_video?.video_url
      || getLargestUrl(video?.transcoded_video)
      || '';
  } else {
    url = image?.large_images?.[0]?.image_url
      || getLargestUrl(common_attr?.cover_url_map)
      || '';
  }

  let prompt = '';
  if (isVideo) {
    const inputs = aigc_image_params?.text2video_params?.video_gen_inputs || [];
    const found = inputs.find(i => !!i.prompt);
    prompt = found?.prompt || '';
  } else {
    prompt = aigc_image_params?.text2image_params?.prompt
      || common_attr?.title
      || common_attr?.description
      || '';
  }
  prompt = prompt.replace(/(\s*##\s*)/g, '').replace(/(\s*<\/img>\s*)/g, '').replace(/\u200B/g, '');

  const id = common_attr?.published_item_id || common_attr?.effect_id || common_attr?.id || '';
  const imageId = getImageId(common_attr?.cover_uri || url);
  const thumbUrl = getLargestUrl(common_attr?.cover_url_map) || common_attr?.cover_url || '';

  if (!url || !id) return null;

  return {
    id,
    url,
    prompt,
    imageId,
    generateType,
    thumbUrl,
    format: isVideo ? 'mp4' : (image?.format || 'png'),
    timestamp: Date.now()
  };
}

function parseApiResponse(url, body, data) {
  const results = [];
  const items = [];

  if (url.includes('/mweb/v1/get_item_info')) {
    if (data?.image || data?.video) items.push(data);
  } else if (url.includes('/mweb/v1/get_history_by_ids')) {
    const ids = body?.submit_ids || body?.history_ids || [];
    ids.forEach(id => {
      const record = (data || {})[id] || {};
      if (Array.isArray(record.item_list)) items.push(...record.item_list);
    });
  } else if (Array.isArray(data?.item_list)) {
    items.push(...data.item_list);
  } else if (Array.isArray(data?.records_list)) {
    data.records_list.forEach(record => {
      if (Array.isArray(record.item_list)) items.push(...record.item_list);
    });
  } else if (Array.isArray(data?.group_list)) {
    data.group_list.forEach(group => {
      if (Array.isArray(group.records_list)) {
        group.records_list.forEach(record => {
          if (Array.isArray(record.item_list)) items.push(...record.item_list);
        });
      }
    });
  } else if (Array.isArray(data?.asset_list)) {
    data.asset_list.forEach(asset => {
      const item = asset.video || asset.image;
      if (item) items.push(item);
    });
  }

  items.forEach(item => {
    const parsed = parseItem(item);
    if (parsed) results.push(parsed);
  });

  return results;
}


// ===== 自动化服务类 =====

class AutomationService {
  constructor(page, downloadDir) {
    this.page = page;
    this.downloadDir = downloadDir || path.join(process.env.HOME, 'Downloads', '即梦');
    this.results = [];         // 拦截到的作品
    this.knownIds = new Set(); // 去重
    this.listeners = [];       // 事件回调
    this.apiListenerAttached = false;
    this.taskQueue = [];       // 任务队列
    this.processing = false;   // 是否正在处理队列
    this.lastResultCount = 0;  // 上次结果数（用于检测新结果）

    // 确保下载目录存在
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }

    // ===== Debug 日志文件（追加模式）=====
    this._logFile = path.join(this.downloadDir, 'automation-debug.log');
    this._log('[系统] AutomationService 初始化');
  }

  /**
   * 写日志到文件 + console
   */
  _log(msg) {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const line = `[${ts}] ${msg}`;
    console.log(line);
    try { fs.appendFileSync(this._logFile, line + '\n'); } catch {}
  }

  // ===== 事件系统 =====
  on(callback) {
    this.listeners.push(callback);
  }

  off(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }

  _emit(event, data) {
    this.listeners.forEach(cb => {
      try { cb(event, data); } catch (e) { console.warn('事件回调错误:', e); }
    });
  }

  // ===== 核心：API 拦截 =====
  startApiInterception() {
    if (this.apiListenerAttached) return;
    this.apiListenerAttached = true;

    this.page.on('response', async (response) => {
      const url = response.url();
      if (!isJimengApi(url)) return;

      try {
        const data = await response.json();
        let body = {};
        try {
          const request = response.request();
          const postData = request.postData();
          if (postData) body = JSON.parse(postData);
        } catch {}

        const results = parseApiResponse(url, body, data);
        results.forEach(item => {
          if (this.knownIds.has(item.id)) return;
          this.knownIds.add(item.id);
          this.results.unshift(item);
          if (this.results.length > 200) this.results = this.results.slice(0, 200);
          this._emit('result', item);
          console.log(`[自动化] 拦截到作品: ${item.generateType} | ${item.prompt.slice(0, 40)}`);
        });

        // 检测是否有新结果 → 自动补位
        if (this.results.length > this.lastResultCount && this.taskQueue.length > 0) {
          this.lastResultCount = this.results.length;
          console.log('[自动化] 检测到新完成作品，3秒后自动补位...');
          setTimeout(() => this.processQueue(), 3000);
        }
      } catch (e) {
        // 静默处理解析失败
      }
    });

    // 也启动 DOM 轮询作为补充
    this.startDomPolling();
    console.log('[自动化] API 拦截已启动');
  }

  // ===== DOM 轮询（补充 API 拦截） =====
  startDomPolling(intervalMs = 8000) {
    if (this._domPollTimer) return;
    this._domPollTimer = setInterval(async () => {
      try {
        if (!this.page || this.page.isClosed()) return;
        await this.page.evaluate(() => {
          // 扫描页面上的视频元素（作为补充检测）
          const videos = document.querySelectorAll('video');
          window.__jimengVideoCount = videos.length;
        });
      } catch {}
    }, intervalMs);
  }

  stopDomPolling() {
    if (this._domPollTimer) {
      clearInterval(this._domPollTimer);
      this._domPollTimer = null;
    }
  }

  // ===== 状态机辅助方法（2026-03-31 重构） =====

  /**
   * 扫描页面当前状态 — 每轮循环都调用，不依赖旧快照
   */
  async scanPageState() {
    return await this.page.evaluate(() => {
      const visibleTexts = [];
      const allEls = document.querySelectorAll('button, span, div, a, li');
      for (const el of allEls) {
        if (el.offsetParent !== null) {
          visibleTexts.push((el.textContent || '').trim());
        }
      }

      // 合并检查，避免 eachText.includes 的歧义
      const hasVideoGen = visibleTexts.some(t => t === '视频生成' || t === '视频生成 ▾');
      const hasOmniRef = visibleTexts.some(t => t.includes('全能参考'));
      const hasSubMode = visibleTexts.some(t => t.includes('首尾帧') || t.includes('智能多帧'));
      const hasAgentMode = visibleTexts.some(t => t.includes('Agent 模式'));

      return { hasVideoGen, hasOmniRef, hasSubMode, hasAgentMode };
    });
  }

  /**
   * 精确检测「视频生成 + 全能参考」模式是否真正激活
   * 
   * 检测方法：
   * 1. 找到模式选择器，检查当前显示的文本
   * 2. 找到子模式选择器，检查当前显示的文本
   * 3. 检测上传区域是否存在（全能参考特有）
   * 
   * @returns {Promise<{mode: string, subMode: string, hasUploadArea: boolean, success: boolean}>}
   */
  async verifyModeState() {
    return await this.page.evaluate(() => {
      const result = {
        mode: 'unknown',
        subMode: 'unknown',
        hasUploadArea: false,
        success: false,
      };

      // 方法 1：检查 Agent 模式下拉按钮显示的当前值
      // 即梦的模式选择器结构：按钮内包含当前选中的模式名
      const modeButtons = document.querySelectorAll('button, [role="combobox"]');
      for (const btn of modeButtons) {
        const text = (btn.textContent || '').trim();
        // 检查是否包含模式名称（不含其他杂项）
        if (text === '视频生成' || text === '图片生成' || text === '数字人配音生成') {
          result.mode = text;
          break;
        }
        // 有些下拉按钮可能是「Agent 模式 ▾」+ 旁边显示当前值
        if (text.includes('视频生成')) {
          result.mode = '视频生成';
          break;
        }
      }

      // 方法 2：检查子模式下拉（首尾帧 / 全能参考）
      const subModeButtons = document.querySelectorAll('button, [role="combobox"]');
      for (const btn of subModeButtons) {
        const text = (btn.textContent || '').trim();
        if (text.includes('全能参考')) {
          result.subMode = '全能参考';
          break;
        }
        if (text.includes('首尾帧')) {
          result.subMode = '首尾帧';
          break;
        }
        if (text.includes('智能多帧')) {
          result.subMode = '智能多帧';
          break;
        }
      }

      // 方法 3：检测上传区域（全能参考特有）
      // 全能参考模式会有素材上传入口（拖拽区域或上传按钮）
      const uploadArea = document.querySelector('[class*="upload"]')
        || document.querySelector('input[type="file"]')
        || document.querySelector('[class*="drop-zone"]')
        || document.querySelector('[class*="material"]');
      if (uploadArea && uploadArea.offsetParent !== null) {
        result.hasUploadArea = true;
      }

      // 判断是否成功切换到「视频生成 + 全能参考」
      // 宽松判定：mode 为 视频生成，或 subMode 为 全能参考，或有上传区域
      const isVideoGen = result.mode === '视频生成';
      const isOmniRef = result.subMode === '全能参考';
      result.success = isVideoGen || isOmniRef || result.hasUploadArea;

      return result;
    });
  }

  /**
   * 等待页面状态发生变化（对比旧状态）
   * @param {Object} oldState - 上一步的状态快照
   * @param {Object} options - { timeout, interval, expectChange }
   */
  async waitForUIChange(oldState, { timeout = 8000, interval = 400, expectChange = null } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const newState = await this.scanPageState();

      // 如果指定了期望变化，直接检查
      if (expectChange) {
        const matched = Object.entries(expectChange).every(([key, val]) => newState[key] === val);
        if (matched) {
          console.log(`[自动化] UI已变为期望状态:`, JSON.stringify(expectChange));
          return newState;
        }
      } else {
        // 检查任何有意义的变化
        const changed = Object.keys(oldState).some(k => oldState[k] !== newState[k]);
        if (changed) {
          console.log('[自动化] UI已变化:', JSON.stringify(oldState), '→', JSON.stringify(newState));
          return newState;
        }
      }
      await sleep(interval);
    }

    // 超时不算致命，返回当前状态让调用方决定
    const finalState = await this.scanPageState();
    console.log('[自动化] UI变化等待超时，当前状态:', JSON.stringify(finalState));
    return finalState;
  }

  /**
   * 等待页面上出现包含指定文本的可见元素
   * @param {string} text - 要查找的文本（部分匹配）
   * @param {Object} options - { timeout, interval }
   */
  async waitForVisible(text, { timeout = 8000, interval = 400 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await this.page.evaluate((t) => {
        const els = document.querySelectorAll('button, span, div, a, li');
        for (const el of els) {
          if (el.offsetParent !== null && (el.textContent || '').trim().includes(t)) {
            return true;
          }
        }
        return false;
      }, text);
      if (found) return true;
      await sleep(interval);
    }
    return false;
  }

  /**
   * 安全点击：找到包含指定文本的可见元素并点击，带重试
   * @param {string} text - 元素文本（部分匹配）
   * @param {string} selector - CSS 选择器范围
   * @param {Object} options - { timeout, clickTimeout }
   */
  async safeClick(text, selector = 'button, span, div, a, li', { timeout = 5000 } = {}) {
    this._log(`[safeClick] 查找: "${text}"`);
    const found = await this.waitForVisible(text, { timeout });
    if (!found) {
      const debugEls = await this.page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, a, [role="button"], [class*="tab"], [class*="dropdown"]'))
          .filter(el => el.offsetParent !== null)
          .map(el => `[${el.tagName}] ${(el.textContent || '').trim().slice(0, 25)}`)
          .slice(0, 15);
      }).catch(() => ['(获取失败)']);
      this._log(`[safeClick] ❌ 页面元素:\n${debugEls.join('\n')}`);
      throw new Error(`未找到包含「${text}」的可见元素`);
    }

    await randomDelay(200, 500);

    const result = await this.page.evaluate(({ text: t, sel }) => {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetParent !== null && (el.textContent || '').trim().includes(t)) {
          el.click();
          return { success: true, text: (el.textContent || '').trim().slice(0, 30) };
        }
      }
      return { success: false, error: `点击时元素消失: ${t}` };
    }, { text, sel: selector });

    if (!result.success) throw new Error(result.error);
    this._log(`[safeClick] ✅ "${result.text}"`);
    return result;
  }

  /**
   * 点击下拉选项（精确匹配优先）
   * 
   * 关键修复：下拉选项点击需要精确匹配，避免点到整个容器
   * 
   * 逻辑：
   * 1. 先找 text === targetText 的元素（精确匹配）
   * 2. 降级：找包含 targetText 且文字最短的元素
   * 
   * @param {string} targetText - 目标文本（如 "视频生成"、"全能参考"）
   * @param {string} selector - 选项选择器
   * @param {Object} options - { timeout }
   */
  async clickDropdownOption(targetText, selector = 'li, [role="option"], [class*="dropdown-item"], [class*="menu-item"]', { timeout = 5000 } = {}) {
    this._log(`[下拉选项] 查找: "${targetText}"`);
    
    await randomDelay(300, 600);

    const result = await this.page.evaluate(({ text: t, sel }) => {
      const options = document.querySelectorAll(sel);
      
      // 方法 1：精确匹配
      for (const opt of options) {
        const text = (opt.textContent || '').trim();
        if (text === t && opt.offsetParent !== null) {
          opt.click();
          return { success: true, text, method: 'exact' };
        }
      }
      
      // 方法 2：找包含目标文字且文字最短的
      let shortest = null;
      let shortestLen = Infinity;
      for (const opt of options) {
        const text = (opt.textContent || '').trim();
        if (text.includes(t) && opt.offsetParent !== null) {
          if (text.length < shortestLen) {
            shortest = opt;
            shortestLen = text.length;
          }
        }
      }
      
      if (shortest) {
        shortest.click();
        return { success: true, text: (shortest.textContent || '').trim().slice(0, 50), method: 'shortest' };
      }
      
      // 方法 3：打印所有可见选项帮助调试
      const visibleOptions = Array.from(options)
        .filter(o => o.offsetParent !== null)
        .map(o => (o.textContent || '').trim().slice(0, 30));
      
      return { 
        success: false, 
        error: `未找到「${t}」选项`,
        visibleOptions
      };
    }, { text: targetText, sel: selector });

    if (!result.success) {
      this._log(`[下拉选项] ❌ ${result.error}`);
      if (result.visibleOptions) {
        this._log(`[下拉选项] 可见选项: ${result.visibleOptions.join(', ')}`);
      }
      throw new Error(result.error);
    }

    this._log(`[下拉选项] ✅ "${result.text}" (${result.method})`);
    return result;
  }

  // ===== DOM 定位（从 content.js 移植，精确选择器） =====

  // 获取提示词编辑器
  async _getPromptEditor() {
    return await this.page.evaluate(() => {
      // 方法 1：Tiptap ProseMirror（即梦当前实际结构）
      const tiptaps = document.querySelectorAll('.tiptap.ProseMirror');
      for (const el of tiptaps) {
        if (el.offsetParent !== null && el.contentEditable === 'true') return 'tiptap';
      }

      // 方法 2：任意 contenteditable="true" 且 visible
      const editables = document.querySelectorAll('[contenteditable="true"]');
      for (const el of editables) {
        if (el.offsetParent !== null) return 'contenteditable';
      }

      // 方法 3：可见的 textarea
      const textareas = document.querySelectorAll('textarea');
      for (const ta of textareas) {
        if (ta.offsetParent !== null) return 'textarea';
      }

      return null;
    });
  }

  // 获取编辑器容器（用于定位上传/提交按钮）
  async _getEditorContainer() {
    return await this.page.evaluate(() => {
      const editor = document.querySelector('#prompt-text-editor p')
        || document.querySelector('#prompt-text-editor')
        || document.querySelector('textarea.lv-textarea');
      if (!editor) return null;

      let current = editor;
      while (current && current !== document.body) {
        if (typeof current.className === 'string' && current.className.includes('dimension-layout')) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    });
  }

  // 检查提交按钮是否可用
  async _isSubmitReady() {
    return await this.page.evaluate(() => {
      // 找提交按钮（即梦用 .lv-btn-primary + class 包含 submit）
      const btns = document.querySelectorAll('button[class*="submit"]');
      for (const btn of btns) {
        if (btn.offsetParent !== null && !btn.disabled) {
          // 检查 SVG path 判断是否可用（不可用时 icon 是灰色的）
          const svg = btn.querySelector('svg');
          if (svg) {
            const paths = svg.querySelectorAll('path');
            // 如果所有 path 都是灰色/半透明，说明不可用
            let allGray = true;
            for (const p of paths) {
              const fill = p.getAttribute('fill') || p.getAttribute('stroke') || '';
              if (fill && fill !== 'none' && !fill.includes('4D') && !fill.includes('rgba')) {
                allGray = false;
                break;
              }
            }
            if (allGray && paths.length > 0) return false;
          }
          return true;
        }
      }
      return false;
    });
  }

  // ===== 操作：填写 Prompt =====
  async setPrompt(prompt) {
    const promptText = String(prompt || '');

    return await withRetry(async () => {
      // 先等编辑器出现
      const editorType = await waitFor(
        () => this._getPromptEditor(),
        { timeout: 10000, interval: 300, errorMessage: '未找到提示词编辑器' }
      );

      await randomDelay();

      // 根据编辑器类型填写
      const result = await this.page.evaluate(({ type, text }) => {
        // 通用：找到可见的 Tiptap ProseMirror 编辑器
        function getVisibleEditor() {
          // 优先找 .tiptap.ProseMirror
          const tiptaps = document.querySelectorAll('.tiptap.ProseMirror');
          for (const el of tiptaps) {
            if (el.offsetParent !== null && el.contentEditable === 'true') return el;
          }
          // 降级：任意可见 contenteditable
          const editables = document.querySelectorAll('[contenteditable="true"]');
          for (const el of editables) {
            if (el.offsetParent !== null) return el;
          }
          // 降级：textarea
          const tas = document.querySelectorAll('textarea');
          for (const ta of tas) {
            if (ta.offsetParent !== null) return ta;
          }
          return null;
        }

        const editor = getVisibleEditor();
        if (!editor) return { success: false, error: '找不到可见编辑器' };

        editor.click();
        editor.focus?.();

        if (editor.tagName === 'TEXTAREA') {
          editor.value = text;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          editor.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, method: 'textarea' };
        }

        // Tiptap / contenteditable
        editor.innerHTML = '';
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(text));
        editor.appendChild(p);

        // 触发 InputEvent
        try {
          editor.dispatchEvent(new InputEvent('input', {
            bubbles: true, cancelable: true, inputType: 'insertText', data: text
          }));
        } catch {
          editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        editor.dispatchEvent(new Event('change', { bubbles: true }));

        // 移除 is-editor-empty class（如果存在）
        if (editor.classList.contains('is-editor-empty')) {
          editor.classList.remove('is-editor-empty');
        }

        return { success: true, method: 'tiptap' };
      }, { type: editorType, text: promptText });

      if (!result.success) throw new Error(result.error);

      await randomDelay(500, 1200);
      console.log(`[自动化] 提示词已填写 (${result.method})`);
      return result;

    }, { retries: 2, stepName: '填写提示词' });
  }

  /**
   * 填写带 @ 引用的提示词（v2 键盘导航版）
   * 
   * 核心发现（2026-03-31 测试验证）：
   * - 即梦的 @ 下拉选项是：li.lv-select-option
   * - 必须用 ArrowDown + Enter 键盘导航选择，不能用鼠标点击
   * - 插入的引用节点 class 是：node-reference-mention-tag
   * - 下拉顺序是：图片1, 视频1（按上传顺序）
   * 
   * @param {string} prompt - 原始提示词
   * @param {number} imageCount - 图片素材数量
   * @param {number} videoCount - 视频素材数量
   */
  async setPromptWithReferences(prompt, imageCount = 0, videoCount = 0) {
    this._log(`[提示词] 开始填写带@引用的提示词（${imageCount}图${videoCount}视频）`);

    // 等编辑器出现
    await waitFor(
      () => this._getPromptEditor(),
      { timeout: 10000, interval: 300, errorMessage: '未找到提示词编辑器' }
    );
    await randomDelay();

    // 聚焦编辑器
    const editorEl = await this.page.$('.tiptap.ProseMirror[contenteditable="true"]');
    if (!editorEl) throw new Error('找不到可见编辑器');
    await editorEl.click();
    await randomDelay(300, 500);

    // 清空编辑器
    await this.page.keyboard.press('Meta+a');
    await this.page.keyboard.press('Backspace');
    await randomDelay(300, 500);

    // ===== 构建引用序列 =====
    // 下拉顺序是按上传顺序：图片1, 图片2, ..., 视频1, 视频2, ...
    // 每个 @ 触发后需要 ArrowDown N 次（N = 该素材在下拉中的索引）+ Enter
    const refSequence = [];
    let optionIndex = 0;
    for (let i = 0; i < imageCount; i++) {
      refSequence.push({ name: `图片${i + 1}`, dropdownIndex: optionIndex });
      optionIndex++;
    }
    for (let i = 0; i < videoCount; i++) {
      refSequence.push({ name: `视频${i + 1}`, dropdownIndex: optionIndex });
      optionIndex++;
    }

    this._log(`[提示词] 引用序列: ${JSON.stringify(refSequence)}`);

    // ===== 逐个插入引用 + 文字 =====
    // 先输入 "让"
    await this.page.keyboard.type('让', { delay: 80 });
    await randomDelay(200, 400);

    for (let idx = 0; idx < refSequence.length; idx++) {
      const ref = refSequence[idx];
      this._log(`[提示词] 插入引用: @${ref.name} (下拉第 ${ref.dropdownIndex + 1} 项)`);

      // 输入 @ 触发下拉
      await this.page.keyboard.type('@', { delay: 80 });
      await randomDelay(1500, 2500); // 等下拉动画

      // 用键盘导航：ArrowDown 指定次数
      for (let i = 0; i < ref.dropdownIndex; i++) {
        await this.page.keyboard.press('ArrowDown');
        await randomDelay(100, 200);
      }

      // Enter 确认选择
      await this.page.keyboard.press('Enter');
      await randomDelay(500, 800);

      // 检查是否插入成功
      const inserted = await this.page.evaluate(() => {
        const mentions = document.querySelectorAll('.node-reference-mention-tag');
        return mentions.length;
      });
      this._log(`[提示词] ✅ 当前引用节点数: ${inserted}`);

      // 在引用之间插入文字
      if (idx < refSequence.length - 1) {
        // 还有更多引用要插，先输入分隔文字
        if (idx === 0 && imageCount > 0 && videoCount > 0) {
          // 图片 → 视频 的转换
          await this.page.keyboard.type(' 里的这个人照着', { delay: 60 });
        } else {
          await this.page.keyboard.type(' ', { delay: 60 });
        }
        await randomDelay(200, 400);
      }
    }

    // 输入结尾文字
    await this.page.keyboard.type(' 里的动作做舞蹈。', { delay: 60 });
    await randomDelay(500, 1000);

    // 最终验证
    const finalContent = await this.page.evaluate(() => {
      const editor = document.querySelector('.tiptap.ProseMirror[contenteditable="true"]');
      if (!editor) return { text: 'no editor' };
      return {
        text: editor.textContent,
        mentions: editor.querySelectorAll('.node-reference-mention-tag').length,
      };
    });
    this._log(`[提示词] ✅ 最终内容: "${finalContent.text}", 引用数: ${finalContent.mentions}`);

    return { success: true, content: finalContent.text, mentions: finalContent.mentions };
  }

  // ===== 操作：上传图片 =====
  async uploadImages(filePaths) {
    const normalizedFiles = Array.from(filePaths || []).filter(Boolean);
    if (!normalizedFiles.length) return { success: true, method: 'no-files' };

    return await withRetry(async () => {
      await randomDelay();

      // 先清除旧的参考图
      await this._clearReferenceImages();
      await randomDelay();

      // 方法 1：直接找 input[type="file"]
      const fileInput = await this.page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.setInputFiles(normalizedFiles);

        // 关键修复：手动触发 change 事件，让即梦前端响应文件变化
        await this.page.evaluate(() => {
          const input = document.querySelector('input[type="file"]');
          if (input) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        console.log('[自动化] 已触发 change/input 事件');

        // 等待上传完成（检测参考图出现）—— 给更长时间
        await waitFor(
          () => this.page.evaluate((count) => {
            const refs = document.querySelectorAll('[class*="reference-item"] img, [class*="preview"] img, [class*="reference"] img');
            return refs.length >= count || refs.length > 0;
          }, normalizedFiles.length),
          { timeout: 30000, interval: 500, errorMessage: '上传后未检测到参考图' }
        ).catch((e) => {
          console.warn('[自动化] 上传检测超时:', e.message);
        });

        console.log(`[自动化] 已上传 ${normalizedFiles.length} 个文件 (file-input + change event)`);
        return { success: true, method: 'file-input', count: normalizedFiles.length };
      }

      // 方法 2：通过点击上传按钮触发 filechooser
      const uploadBtn = await this.page.$('button:has-text("上传")')
        || await this.page.$('[class*="upload"]');
      if (uploadBtn) {
        const [fileChooser] = await Promise.all([
          this.page.waitForEvent('filechooser', { timeout: 5000 }),
          uploadBtn.click()
        ]);
        await fileChooser.setFiles(normalizedFiles);
        console.log(`[自动化] 已上传 ${normalizedFiles.length} 个文件 (file-chooser)`);
        return { success: true, method: 'file-chooser', count: normalizedFiles.length };
      }

      return { success: false, error: '找不到上传入口' };
    }, { retries: 2, stepName: '上传素材' });
  }

  // 清除已有参考图
  async _clearReferenceImages() {
    let count = 0;
    while (count < 10) {
      const removed = await this.page.evaluate(() => {
        const removeBtn = document.querySelector('[class*="remove-button-container"]')
          || document.querySelector('[class*="reference-item"] [class*="remove"]')
          || document.querySelector('[class*="delete-btn"]');
        if (removeBtn && removeBtn.offsetParent !== null) {
          removeBtn.click();
          return true;
        }
        return false;
      });
      if (!removed) break;
      count++;
      await sleep(100);
    }
    if (count > 0) console.log(`[自动化] 清除了 ${count} 个旧参考图`);
  }

  // ===== 操作：提交任务 =====
  async submitTask() {
    return await withRetry(async () => {
      // 等编辑器出现
      await waitFor(
        () => this._getPromptEditor(),
        { timeout: 10000, interval: 300, errorMessage: '未找到编辑器，无法提交' }
      );

      // 尝试等提交按钮可用，但不强制（Seedance 模式可能没有传统按钮）
      const hasSubmitBtn = await waitFor(
        () => this._isSubmitReady(),
        { timeout: 5000, interval: 500, errorMessage: '' }
      ).catch(() => false);

      if (!hasSubmitBtn) {
        this._log('[提交] 未检测到传统提交按钮，尝试检查编辑器内容后直接 Enter');
      }

      await randomDelay(300, 800);

      // 聚焦编辑器后按 Enter
      const result = await this.page.evaluate(() => {
        const editor = document.querySelector('.tiptap.ProseMirror')
          || document.querySelector('[contenteditable="true"]')
          || document.querySelector('textarea');
        if (!editor) return { success: false, error: '编辑器消失' };

        // 检查编辑器是否有内容
        const text = (editor.textContent || editor.value || '').trim();
        if (!text) return { success: false, error: '编辑器内容为空，无法提交' };

        editor.focus?.();

        const keyProps = {
          key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13, which: 13,
          bubbles: true, cancelable: true, shiftKey: false
        };
        editor.dispatchEvent(new KeyboardEvent('keydown', keyProps));
        setTimeout(() => {
          editor.dispatchEvent(new KeyboardEvent('keyup', keyProps));
        }, 100);

        return { success: true };
      });

      if (!result.success) throw new Error(result.error);

      this._log('[自动化] 任务已提交');
      return { success: true };
      return { success: true };

    }, { retries: 2, stepName: '提交任务' });
  }

  // ===== 操作：设置参数（时长/比例等） =====
  async setParams(params) {
    return await this.page.evaluate((p) => {
      const results = {};

      // 设置时长
      if (p.duration) {
        const durationBtns = document.querySelectorAll('[class*="duration"] button, [class*="time"] button');
        for (const btn of durationBtns) {
          if (btn.textContent.includes(String(p.duration))) {
            btn.click();
            results.duration = 'set';
            break;
          }
        }
      }

      // 设置比例
      if (p.aspectRatio) {
        const ratioBtns = document.querySelectorAll('[class*="ratio"] button, [class*="aspect"] button');
        for (const btn of ratioBtns) {
          if (btn.textContent.includes(p.aspectRatio)) {
            btn.click();
            results.aspectRatio = 'set';
            break;
          }
        }
      }

      return results;
    }, params);
  }

  // ===== 完整任务流程（填写 + 上传 + 提交） =====
  async runTask({ prompt, files } = {}) {
    console.log('[自动化] 开始任务:', { prompt: (prompt || '').slice(0, 80), fileCount: (files || []).length });

    // 上传素材
    if (files && files.length) {
      await this.uploadImages(files);
    }

    await randomDelay();

    // 填写提示词
    await this.setPrompt(prompt || '');

    await randomDelay(500, 1000);

    // 提交
    const submitResult = await this.submitTask();
    return submitResult;
  }

  // ===== 任务队列 =====
  enqueue(task) {
    this.taskQueue.push({
      id: task.id || Date.now().toString(),
      prompt: task.prompt,
      files: task.files || [],
      status: 'pending',
      addedAt: Date.now(),
    });
    console.log(`[队列] 入队，当前队列长度: ${this.taskQueue.length}`);
    this._emit('queue-update', this.getQueueStatus());
  }

  async processQueue() {
    if (this.processing || this.taskQueue.length === 0) return;
    this.processing = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue[0];
      task.status = 'processing';
      this._emit('queue-update', this.getQueueStatus());

      try {
        await this.runTask({ prompt: task.prompt, files: task.files });
        task.status = 'submitted';
        this._emit('queue-task-submitted', task);
        console.log(`[队列] 任务已提交: ${task.prompt?.slice(0, 40)}`);
      } catch (err) {
        task.status = 'failed';
        task.error = err.message;
        this._emit('queue-task-failed', task);
        console.error(`[队列] 任务失败: ${err.message}`);
      }

      // 移除已处理的任务
      this.taskQueue.shift();
      this._emit('queue-update', this.getQueueStatus());

      // 等一会再处理下一个（等页面响应）
      if (this.taskQueue.length > 0) {
        await sleep(3000);
      }
    }

    this.processing = false;
  }

  getQueueStatus() {
    return {
      pending: this.taskQueue.filter(t => t.status === 'pending').length,
      processing: this.taskQueue.filter(t => t.status === 'processing').length,
      total: this.taskQueue.length,
      isProcessing: this.processing,
    };
  }

  // ===== 等待任务完成（API 拦截 + DOM 双通道） =====
  async waitForCompletion(timeout = 300000) {
    const startLen = this.results.length;
    const start = Date.now();

    return new Promise((resolve, reject) => {
      // 方式 1：监听新结果
      const check = (event, data) => {
        if (event === 'result' && this.results.length > startLen) {
          cleanup();
          resolve(this.results[0]); // 最新的结果
        }
      };

      const timer = setInterval(() => {
        if (this.results.length > startLen) {
          cleanup();
          resolve(this.results[0]);
        }
      }, 2000);

      const timeoutTimer = setTimeout(() => {
        cleanup();
        reject(new Error('等待任务完成超时（5分钟）'));
      }, timeout);

      const cleanup = () => {
        this.off(check);
        clearInterval(timer);
        clearTimeout(timeoutTimer);
      };

      this.on(check);
    });
  }

  // ===== 下载文件 =====
  async downloadFile(item) {
    const ext = item.generateType === 'video' ? '.mp4' : `.${item.format || 'png'}`;
    const safeName = (item.prompt || 'jimeng').slice(0, 40).replace(/[\\/:*?"<>|]/g, '_');
    const filename = `${safeName}_${item.id.slice(-8)}${ext}`;
    const filepath = path.join(this.downloadDir, filename);

    return new Promise((resolve, reject) => {
      const url = item.url;
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(filepath);

      protocol.get(url, (response) => {
        // 处理重定向
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(filepath);
          item.url = response.headers.location;
          this.downloadFile(item).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(filepath);
          reject(new Error(`下载失败: HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            this._emit('download-progress', { item, progress, downloadedSize, totalSize });
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          console.log(`[自动化] 下载完成: ${filepath}`);
          this._emit('download', { item, filepath });
          resolve({ success: true, filepath, filename });
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        reject(err);
      });
    });
  }

  // ===== 下载全部 =====
  async downloadAll() {
    const items = this.results.filter(r => r.url);
    const results = [];
    for (const item of items) {
      try {
        const result = await this.downloadFile(item);
        results.push(result);
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        results.push({ success: false, error: err.message, item });
      }
    }
    return results;
  }

  // ===== 获取当前所有结果 =====
  getResults() {
    return [...this.results];
  }

  // ===== 登录状态检查 =====
  async checkLoginStatus() {
    if (!this.page) return false;
    try {
      const loggedIn = await this.page.evaluate(() => {
        // 检查头像（已登录标志）
        const avatar = document.querySelector('[class*="avatar-container"]')
          || document.querySelector('[class*="avatar"]');
        if (avatar && avatar.offsetParent !== null) return true;

        // 检查是否有登录按钮（有 = 未登录）
        const allEls = document.querySelectorAll('button, a, span');
        for (const el of allEls) {
          if (el.textContent?.trim() === '登录' && el.offsetParent !== null) return false;
        }
        return null;
      });
      return loggedIn;
    } catch {
      return null;
    }
  }

  // ====================================================================
  // Phase 1: 模式切换 + 模型选择 + 参数设置（Playwright 操作）
  // ====================================================================

  /**
   * 导航到即梦生成页面
   */
  async navigateToGenerate() {
    return await withRetry(async () => {
      const url = this.page.url();
      if (url.includes('/ai-tool/generate')) {
        console.log('[自动化] 已在生成页面');
        // 即使已在页面，也等页面元素加载完
        await this.waitForPageReady();
        return { success: true, skipped: true };
      }

      this._log('[自动化] 正在导航到生成页面...');
      await this.page.goto(JIMENG_GENERATE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // 关键：等待页面核心元素真正渲染出来
      await this.waitForPageReady();

      this._log('[自动化] 已导航到生成页面，页面就绪');
      return { success: true };
    }, { retries: 1, stepName: '导航到生成页面' });
  }

  /**
   * 等待页面核心 UI 元素渲染完成
   * 
   * 判断标准：编辑器（ProseMirror 或 textarea）和至少一个交互按钮出现
   * 不依赖 Seedance 文字（顶部导航栏也有 Seedance，会误判）
   */
  async waitForPageReady({ timeout = 20000, interval = 500 } = {}) {
    this._log('[页面就绪] 等待核心 UI 元素加载...');
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ready = await this.page.evaluate(() => {
        // 检查 1：编辑器是否存在（ProseMirror 或 textarea）
        const hasEditor = !!document.querySelector('.tiptap.ProseMirror[contenteditable="true"]')
          || !!document.querySelector('textarea')
          || !!document.querySelector('[contenteditable="true"]');

        // 检查 2：至少有 5 个可见按钮（说明 UI 已渲染）
        const visibleBtns = Array.from(document.querySelectorAll('button'))
          .filter(b => b.offsetParent !== null);
        const hasButtons = visibleBtns.length >= 5;

        // 检查 3：页面不是全空状态
        const hasContent = document.body.textContent.trim().length > 100;

        return hasEditor && hasButtons && hasContent;
      });
      if (ready) {
        this._log('[页面就绪] ✅ 核心 UI 已加载');
        await randomDelay(1000, 2000);
        return true;
      }
      await sleep(interval);
    }
    this._log('[页面就绪] ⚠️ 等待超时，继续尝试（可能页面加载慢）');
    return false;
  }
  /**
   * 切换到 Seedance 全能参考模式（恢复 5 步流程，2026-03-31）
   *
   * 基于之前成功的日志还原：
   * Step 1: 点击 Seedance tab（必须先切到 Seedance 模式）
   * Step 2: 点击 Agent 模式下拉
   * Step 3: 选择 视频生成
   * Step 4: 点击首尾帧下拉
   * Step 5: 选择 全能参考
   */
  async switchToSeedanceMode() {
    // ===== Step 0: 等页面真正加载完 =====
    await this.waitForPageReady();

    // ===== Step 1: 先点 Seedance tab =====
    this._log('[模式切换] Step 1: 点击 Seedance tab');
    try {
      // 优先找短文本的 Seedance 按钮（tab），避免点到导航栏
      await this.safeClick('Seedance', 'button, span', { timeout: 8000 });
      this._log('[模式切换] ✅ Seedance tab 已点击');
    } catch (e) {
      this._log(`[模式切换] Step 1 失败: ${e.message}`);
    }
    // Seedance tab 切换需要等页面渲染
    await randomDelay(2000, 3000);
    await this.waitForPageReady({ timeout: 10000 });

    // ===== Step 2: 点击 Agent 模式下拉 =====
    this._log('[模式切换] Step 2: 点击 Agent 模式下拉');
    try {
      await this.safeClick('Agent 模式', 'button, [class*="dropdown"], [role="combobox"], span', { timeout: 8000 });
      this._log('[模式切换] ✅ Agent 模式 已点击');
    } catch (e) {
      this._log(`[模式切换] Step 2 失败: ${e.message}`);
    }

    // 等待下拉
    this._log('[模式切换] 等待下拉菜单弹出...');
    const dropdown1 = await this.waitForDropdown({ timeout: 8000 });
    this._log(`[模式切换] 下拉检测结果: ${dropdown1 ? '✅ 已弹出' : '⚠️ 未检测到（继续尝试）'}`);
    await randomDelay(1000, 1500);

    // ===== 关键修复：等待目标选项真正渲染完成 =====
    this._log('[模式切换] 等待「视频生成」选项出现...');
    const optionVisible = await this.waitForVisible('视频生成', { timeout: 5000 });
    if (!optionVisible) {
      this._log('[模式切换] ⚠️ 「视频生成」选项未出现，可能下拉未正确弹出');
    } else {
      this._log('[模式切换] ✅ 「视频生成」选项已出现');
    }
    await randomDelay(300, 600);

    // ===== Step 3: 选择 视频生成 =====
    this._log('[模式切换] Step 3: 选择 视频生成');
    try {
      await this.clickDropdownOption('视频生成');
      this._log('[模式切换] ✅ 视频生成 已选择');
    } catch (e) {
      this._log(`[模式切换] Step 3 失败: ${e.message}`);
    }
    // 视频生成模式切换需要等页面重新渲染
    await randomDelay(2000, 3000);
    await this.waitForPageReady({ timeout: 10000 });

    // ===== Step 4: 点击首尾帧下拉 =====
    this._log('[模式切换] Step 4: 点击首尾帧下拉');
    try {
      await this.safeClick('首尾帧', 'button, [class*="dropdown"], [role="combobox"], span', { timeout: 8000 });
      this._log('[模式切换] ✅ 首尾帧 已点击');
    } catch (e) {
      this._log(`[模式切换] Step 4 失败: ${e.message}`);
    }

    // 等待下拉
    this._log('[模式切换] 等待下拉菜单弹出...');
    const dropdown2 = await this.waitForDropdown({ timeout: 8000 });
    this._log(`[模式切换] 下拉检测结果: ${dropdown2 ? '✅ 已弹出' : '⚠️ 未检测到（继续尝试）'}`);
    await randomDelay(1000, 1500);

    // ===== 关键修复：等待目标选项真正渲染完成 =====
    this._log('[模式切换] 等待「全能参考」选项出现...');
    const optionVisible2 = await this.waitForVisible('全能参考', { timeout: 5000 });
    if (!optionVisible2) {
      this._log('[模式切换] ⚠️ 「全能参考」选项未出现，可能下拉未正确弹出');
    } else {
      this._log('[模式切换] ✅ 「全能参考」选项已出现');
    }
    await randomDelay(300, 600);

    // ===== Step 5: 选择 全能参考 =====
    this._log('[模式切换] Step 5: 选择 全能参考');
    try {
      await this.clickDropdownOption('全能参考');
      this._log('[模式切换] ✅ 全能参考 已选择');
    } catch (e) {
      this._log(`[模式切换] Step 5 失败: ${e.message}`);
    }

    // ===== 最终精确检测 =====
    await randomDelay(1500, 2500);
    const verifyResult = await this.verifyModeState();
    this._log(`[模式切换] 精确检测结果: ${JSON.stringify(verifyResult)}`);

    if (verifyResult.success) {
      this._log(`[模式切换] ✅ 模式切换成功: mode=${verifyResult.mode}, subMode=${verifyResult.subMode}`);
      return { success: true, mode: 'omni-reference', verify: verifyResult };
    }

    this._log('[模式切换] ❌ 模式切换失败，请手动检查');
    return {
      success: false,
      mode: 'unknown',
      error: '精确检测失败',
      verify: verifyResult,
      suggestion: '请在浏览器中手动切换到「Seedance > Agent 模式 > 视频生成 > 首尾帧 > 全能参考」模式'
    };
  }

  /**
   * 等待下拉菜单出现（检测 li 或 div 包含选项文本）
   */
  async waitForDropdown({ timeout = 5000, interval = 200 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await this.page.evaluate(() => {
        // 方法 1：检测下拉菜单容器或选项（li 元素）
        const lis = document.querySelectorAll('li.lv-select-option, li[class*="dropdown-item"], li[class*="menu-item"]');
        for (const li of lis) {
          if (li.offsetParent !== null) return true;
        }
        
        // 方法 2：检测包含选项文本的 visible div（即梦下拉用的是 div 结构）
        const optionTexts = ['视频生成', '图片生成', '数字人配音生成', '全能参考', '首尾帧', '智能多帧'];
        const divs = document.querySelectorAll('div');
        for (const div of divs) {
          if (div.offsetParent !== null) {
            const text = (div.textContent || '').trim();
            // 如果 div 内包含任一选项文本，且 div 本身较短（排除大容器）
            if (text.length < 30) {
              for (const opt of optionTexts) {
                if (text.includes(opt)) return true;
              }
            }
          }
        }
        
        // 方法 3：检测任意 visible li（降级）
        const anyLi = document.querySelectorAll('li');
        for (const li of anyLi) {
          if (li.offsetParent !== null && (li.textContent || '').trim().length > 0) return true;
        }
        return false;
      });
      if (found) return true;
      await sleep(interval);
    }
    return false;
  }
  /**
   * 选择模型
   * @param {string} model - 'seedance_2.0_fast' | 'seedance_2.0'
   */
  async selectModel(model) {
    const modelConfig = MODEL_MAP[model];
    if (!modelConfig) {
      console.warn(`[自动化] 未知模型: ${model}，可用:`, Object.keys(MODEL_MAP));
      return { success: false, error: `未知模型: ${model}` };
    }

    // 检查是否已经选了目标模型
    const alreadySelected = await this.page.evaluate((label) => {
      const btns = document.querySelectorAll('button, span, div');
      for (const el of btns) {
        const text = (el.textContent || '').trim();
        if (el.offsetParent !== null && text.includes(label)) {
          // 确认是"当前选中"而非下拉选项
          const isDropdownItem = el.closest('[class*="dropdown-item"], [class*="menu-item"], [role="option"]');
          if (!isDropdownItem) return true;
        }
      }
      return false;
    }, modelConfig.label);

    if (alreadySelected) {
      console.log(`[自动化] 模型已是 ${modelConfig.label}，跳过`);
      return { success: true, model, label: modelConfig.label, skipped: true };
    }

    // Step 1：点击模型选择器展开下拉
    console.log('[自动化] 展开模型下拉...');
    await this.safeClick('Seedance', 'button, div[class*="model"], span[class*="model"]');
    await randomDelay(800, 1200);

    // Step 2：等待下拉菜单出现
    const dropdownVisible = await this.waitForVisible(modelConfig.label, { timeout: 5000 });
    if (!dropdownVisible) {
      // 降级：尝试找包含 "Fast" 的选项
      if (modelConfig.label.includes('Fast')) {
        await this.safeClick('Fast', '[class*="dropdown-item"], [class*="menu-item"], [role="option"], li, div[class*="option"]');
      } else {
        throw new Error(`下拉菜单中未找到 ${modelConfig.label}`);
      }
    } else {
      await this.safeClick(modelConfig.label, '[class*="dropdown-item"], [class*="menu-item"], [role="option"], li, div[class*="option"]');
    }

    // Step 3：确认选中（等UI更新，检查当前显示的模型名）
    await randomDelay(500, 1000);
    const confirmed = await this.page.evaluate((label) => {
      const btns = document.querySelectorAll('button, span, div');
      for (const el of btns) {
        const text = (el.textContent || '').trim();
        if (el.offsetParent !== null && text.includes(label)) {
          const isDropdownItem = el.closest('[class*="dropdown-item"], [class*="menu-item"], [role="option"]');
          if (!isDropdownItem) return true;
        }
      }
      return false;
    }, modelConfig.label);

    if (!confirmed) {
      console.log(`[自动化] 模型选择可能未生效，继续（非致命）`);
    }

    console.log('[自动化] 已选择模型:', modelConfig.label);
    this._currentModel = model;
    await randomDelay(500, 1000);
    return { success: true, model, label: modelConfig.label };
  }

  /**
   * 设置视频时长（秒）
   * @param {number} seconds - 4-15
   */
  async setDuration(seconds) {
    const validDurations = VALID_DURATIONS;
    const closest = validDurations.reduce((prev, curr) =>
      Math.abs(curr - seconds) < Math.abs(prev - seconds) ? curr : prev
    );

    return await withRetry(async () => {
      await randomDelay();

      const result = await this.page.evaluate((dur) => {
        // 找时长选择按钮
        const btns = document.querySelectorAll('button, [class*="duration"] span, [class*="time"] span');
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === `${dur}s` || text === `${dur}秒` || text === String(dur)) {
            if (btn.offsetParent !== null) {
              btn.click();
              return { success: true, value: dur };
            }
          }
        }
        return { success: false, error: `未找到 ${dur}s 时长选项` };
      }, closest);

      if (!result.success) throw new Error(result.error);
      console.log('[自动化] 已设置时长:', closest + 's');
      this._currentDuration = closest;
      await randomDelay(500, 1000);
      return { success: true, duration: closest };

    }, { retries: 1, stepName: '设置时长' });
  }

  /**
   * 设置画面比例
   * @param {string} ratio - '9:16' | '16:9' | '1:1' | '4:3' | '3:4' | '21:9'
   */
  async setAspectRatio(ratio) {
    if (!ASPECT_RATIOS.includes(ratio)) {
      console.warn(`[自动化] 未知比例: ${ratio}，可用:`, ASPECT_RATIOS);
      return { success: false, error: `未知比例: ${ratio}` };
    }

    return await withRetry(async () => {
      await randomDelay();

      const result = await this.page.evaluate((r) => {
        const btns = document.querySelectorAll('button, [class*="ratio"] span, [class*="aspect"] span');
        for (const btn of btns) {
          const text = (btn.textContent || '').trim();
          if (text === r && btn.offsetParent !== null) {
            btn.click();
            return { success: true, value: r };
          }
        }
        return { success: false, error: `未找到比例选项: ${r}` };
      }, ratio);

      if (!result.success) throw new Error(result.error);
      console.log('[自动化] 已设置比例:', ratio);
      this._currentRatio = ratio;
      await randomDelay(500, 1000);
      return { success: true, ratio };

    }, { retries: 1, stepName: '设置比例' });
  }

  // ====================================================================
  // Phase 2: 素材上传（浏览器上下文中调用即梦 API，需要 cookies）
  // ====================================================================

  /**
   * 上传图片文件，返回 StoreUri
   * @param {string} filePath - 本地图片路径
   * @returns {Promise<{success: boolean, storeUri?: string, error?: string}>}
   */
  async uploadImage(filePath) {
    return await withRetry(async () => {
      const fs = require('fs');
      if (!fs.existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'png';
      const mimeType = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[ext] || 'image/png';

      console.log('[自动化] 开始上传图片:', fileName, `(${(fileBuffer.length / 1024).toFixed(1)}KB)`);

      // Step 1: 获取上传 token
      const tokenResult = await this.page.evaluate(async (scene) => {
        try {
          const resp = await fetch('/mweb/v1/get_upload_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scene }),
          });
          const data = await resp.json();
          if (data.code !== 0) return { success: false, error: data.message || '获取token失败' };
          return { success: true, data: data.data };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, 2); // scene=2 for image

      if (!tokenResult.success) throw new Error(`获取上传token失败: ${tokenResult.error}`);
      console.log('[自动化] 图片上传token已获取');

      const tokenData = tokenResult.data;
      const accessKeyId = tokenData.access_key_id;
      const secretAccessKey = tokenData.secret_access_key;
      const sessionToken = tokenData.session_token;

      // Step 2: 通过浏览器上下文上传（因为需要签名，更安全地在浏览器中执行）
      const uploadResult = await this.page.evaluate(async ({ fileName, mimeType, fileData }) => {
        try {
          // 将 base64 转为 Uint8Array
          const binaryString = atob(fileData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

          // 构建上传 URL（imagex）
          const uploadUrl = `https://imagex.bytedanceapi.com/ApplyImageUpload?Version=2018-08-01&SpaceName=jimeng`;

          // 发起 ApplyImageUpload 请求获取上传地址
          const applyResp = await fetch(uploadUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          const applyData = await applyResp.json();

          if (applyData?.Result?.UploadAddress?.StoreInfos?.[0]) {
            const storeInfo = applyData.Result.UploadAddress.StoreInfos[0];
            const storeUri = storeInfo.StoreUri;
            const uploadUrl2 = storeInfo.UploadUrl?.[0] || storeInfo.UploadUrls?.[0] || '';

            if (uploadUrl2) {
              // 上传文件
              const uploadResp = await fetch(uploadUrl2, {
                method: 'POST',
                headers: { 'Content-Type': mimeType },
                body: bytes,
              });
              const crc32 = await uploadResp.text();

              return { success: true, storeUri, crc32 };
            }
            return { success: true, storeUri }; // 有些接口不需要二次上传
          }

          return { success: false, error: 'ApplyImageUpload 返回格式异常: ' + JSON.stringify(applyData).slice(0, 200) };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, { fileName, mimeType, fileData: fileBuffer.toString('base64') });

      if (!uploadResult.success) throw new Error(uploadResult.error);
      console.log('[自动化] 图片上传完成, StoreUri:', uploadResult.storeUri);
      return { success: true, storeUri: uploadResult.storeUri, crc32: uploadResult.crc32 };

    }, { retries: 2, stepName: '上传图片' });
  }

  /**
   * 上传视频文件，返回 vid
   * @param {string} filePath - 本地视频路径
   * @returns {Promise<{success: boolean, vid?: string, error?: string}>}
   */
  async uploadVideo(filePath) {
    return await withRetry(async () => {
      const fs = require('fs');
      if (!fs.existsSync(filePath)) throw new Error(`文件不存在: ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '') || 'mp4';
      const mimeType = { mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm' }[ext] || 'video/mp4';

      console.log('[自动化] 开始上传视频:', fileName, `(${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB)`);

      // Step 1: 获取上传 token (scene=1 for video)
      const tokenResult = await this.page.evaluate(async () => {
        try {
          const resp = await fetch('/mweb/v1/get_upload_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scene: 1 }),
          });
          const data = await resp.json();
          if (data.code !== 0) return { success: false, error: data.message || '获取token失败' };
          return { success: true, data: data.data };
        } catch (e) {
          return { success: false, error: e.message };
        }
      });

      if (!tokenResult.success) throw new Error(`获取上传token失败: ${tokenResult.error}`);
      console.log('[自动化] 视频上传token已获取');

      // Step 2: 通过浏览器上下文上传
      const uploadResult = await this.page.evaluate(async ({ fileName, mimeType, fileData }) => {
        try {
          const binaryString = atob(fileData);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

          // vod ApplyUploadInner
          const applyUrl = `https://vod.bytedanceapi.com/ApplyUploadInner?Version=2020-11-19&FileType=media&IsInner=1&SpaceName=jimeng`;

          const applyResp = await fetch(applyUrl, { method: 'GET' });
          const applyData = await applyResp.json();

          if (applyData?.Result?.InnerUploadAddress?.UploadNodes?.[0]) {
            const node = applyData.Result.InnerUploadAddress.UploadNodes[0];
            const vid = node.Vid;
            const uploadUrl2 = node.StoreInfos?.[0]?.UploadUrl?.[0] || node.StoreInfos?.[0]?.UploadUrls?.[0] || '';

            if (uploadUrl2) {
              const uploadResp = await fetch(uploadUrl2, {
                method: 'POST',
                headers: { 'Content-Type': mimeType },
                body: bytes,
              });
              const crc32 = await uploadResp.text();
              return { success: true, vid, crc32 };
            }
            return { success: true, vid };
          }

          return { success: false, error: 'ApplyUploadInner 返回格式异常: ' + JSON.stringify(applyData).slice(0, 200) };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, { fileName, mimeType, fileData: fileBuffer.toString('base64') });

      if (!uploadResult.success) throw new Error(uploadResult.error);
      console.log('[自动化] 视频上传完成, vid:', uploadResult.vid);
      return { success: true, vid: uploadResult.vid, crc32: uploadResult.crc32 };

    }, { retries: 2, stepName: '上传视频' });
  }

  /**
   * 批量上传素材
   * @param {Array<{path: string, type: 'image' | 'video'}>} materials
   * @returns {Promise<{success: boolean, results: Array}>}
   */
  async uploadMaterials(materials) {
    if (!materials || materials.length === 0) return { success: true, results: [] };

    const results = [];
    for (const mat of materials) {
      try {
        let uploadResult;
        if (mat.type === 'image') {
          uploadResult = await this.uploadImage(mat.path);
        } else if (mat.type === 'video') {
          uploadResult = await this.uploadVideo(mat.path);
        } else {
          results.push({ path: mat.path, type: mat.type, success: false, error: `未知类型: ${mat.type}` });
          continue;
        }
        results.push({ path: mat.path, type: mat.type, ...uploadResult });
      } catch (e) {
        results.push({ path: mat.path, type: mat.type, success: false, error: e.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[自动化] 批量上传完成: ${successCount}/${materials.length} 成功`);
    return { success: successCount > 0, results };
  }

  // ====================================================================
  // Phase 3: 结构化 Prompt 提交（核心改动 — 绕过 UI，直接调用 API）
  // ====================================================================

  /**
   * 生成 UUID
   */
  _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /**
   * 构造 draft_content JSON
   * @param {Object} params
   * @param {Array<{type: 'image' | 'video', storeUri?: string, vid?: string}>} params.materials - 已上传的素材
   * @param {Array<{type: 'material_ref', idx: number} | {type: 'text', text: string}>} params.metaList - 结构化的引用列表
   * @param {Object} params.options - { prompt, duration, aspectRatio, model, seed }
   * @returns {Object} draft_content JSON
   */
  buildDraftContent({ materials, metaList, options }) {
    const modelConfig = MODEL_MAP[options.model || 'seedance_2.0_fast'] || MODEL_MAP['seedance_2.0_fast'];
    const durationMs = (options.duration || 5) * 1000;
    const aspectRatio = options.aspectRatio || '9:16';
    const seed = options.seed || Math.floor(Math.random() * 4294967295);

    // 构造 material_list
    const materialList = [];
    if (materials) {
      materials.forEach((mat) => {
        if (mat.type === 'image' && mat.storeUri) {
          materialList.push({
            material_type: 'image',
            image_info: { source_from: 'upload', uri: mat.storeUri },
          });
        } else if (mat.type === 'video' && mat.vid) {
          materialList.push({
            material_type: 'video',
            video_info: { source_from: 'upload', vid: mat.vid },
          });
        }
      });
    }

    // 构造 meta_list（如果没有提供，用默认的）
    let finalMetaList = metaList;
    if (!finalMetaList || finalMetaList.length === 0) {
      // 默认：把所有素材依次排列，中间用 prompt 连接
      finalMetaList = [];
      materialList.forEach((_, idx) => {
        finalMetaList.push({ meta_type: 'image', material_ref: { material_idx: idx } });
        if (idx < materialList.length - 1 && options.prompt) {
          finalMetaList.push({ meta_type: 'text', text: options.prompt });
        }
      });
      if (options.prompt && materialList.length > 0) {
        finalMetaList.push({ meta_type: 'text', text: '' }); // 尾部
      }
    }

    return {
      type: 'draft',
      component_list: [{
        type: 'video_base_component',
        generate_type: 'gen_video',
        abilities: {
          gen_video: {
            text_to_video_params: {
              video_gen_inputs: [{
                prompt: options.prompt || '',
                video_mode: 2,
                fps: 24,
                duration_ms: durationMs,
                ...(materialList.length > 0 ? {
                  unified_edit_input: {
                    material_list: materialList,
                    meta_list: finalMetaList,
                  },
                } : {}),
              }],
              video_aspect_ratio: aspectRatio,
              seed,
              model_req_key: modelConfig.key,
            },
          },
        },
      }],
    };
  }

  /**
   * 提交生成任务到即梦 API
   * @param {Object} params
   * @param {Object} params.draftContent - 由 buildDraftContent 构造的内容
   * @param {Object} params.options - { model }
   * @returns {Promise<{success: boolean, taskId?: string, data?: any, error?: string}>}
   */
  async submitGeneration({ draftContent, options }) {
    const modelConfig = MODEL_MAP[options?.model || 'seedance_2.0_fast'] || MODEL_MAP['seedance_2.0_fast'];
    const submitId = this._generateUUID();

    const requestBody = {
      submit_id: submitId,
      metrics_extra: JSON.stringify({
        functionMode: 'omni_reference',
        modelReqKey: modelConfig.key,
      }),
      extend: {
        root_model: modelConfig.key,
        m_video_commerce_info: {
          benefit_type: modelConfig.benefit,
          resource_id: 'generate_video',
        },
      },
      draft_content: draftContent,
    };

    console.log('[自动化] 提交生成任务, submit_id:', submitId);

    const result = await this.page.evaluate(async (body) => {
      try {
        const resp = await fetch('/mweb/v1/aigc_draft/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await resp.json();
        if (data.code !== 0) {
          return { success: false, error: data.message || `API 返回错误码: ${data.code}` };
        }
        // 提取 task_id（不同接口返回结构可能不同）
        const taskId = data.data?.task_id
          || data.data?.history_id
          || data.data?.submit_id
          || body.submit_id;
        return { success: true, taskId, data: data.data };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }, requestBody);

    if (!result.success) throw new Error(`提交生成失败: ${result.error}`);
    console.log('[自动化] 生成任务已提交, taskId:', result.taskId);
    return result;
  }

  /**
   * 轮询任务状态
   * @param {string} taskId - 任务 ID
   * @param {Object} options - { timeout, interval }
   * @returns {Promise<{success: boolean, status?: string, data?: any}>}
   */
  async pollTaskStatus(taskId, { timeout = 300000, interval = 5000 } = {}) {
    const start = Date.now();
    console.log('[自动化] 开始轮询任务状态, taskId:', taskId);

    while (Date.now() - start < timeout) {
      const result = await this.page.evaluate(async (tid) => {
        try {
          // 查询任务状态
          const resp = await fetch('/mweb/v1/get_history_by_ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ submit_ids: [tid] }),
          });
          const data = await resp.json();
          if (data.code !== 0) return { success: false, error: data.message };

          const records = data.data || {};
          const record = records[tid] || {};
          const items = record.item_list || [];

          if (items.length > 0) {
            const item = items[0];
            const status = item.status || item.generate_status || 'unknown';
            return { success: true, status, item };
          }

          return { success: true, status: 'pending', item: null };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, taskId);

      if (result.success) {
        if (result.status === 'completed' || result.status === 'success' || result.item?.image || result.item?.video) {
          console.log('[自动化] 任务完成:', taskId);
          // 解析为标准结果格式
          const parsed = parseItem(result.item);
          if (parsed) {
            this._emit('result', parsed);
            this.results.unshift(parsed);
          }
          return { success: true, status: 'completed', data: parsed || result.item };
        }
        console.log(`[自动化] 任务状态: ${result.status}, 继续轮询...`);
      }

      await sleep(interval);
    }

    return { success: false, error: '轮询超时', status: 'timeout' };
  }

  /**
   * 完整的结构化生成流程：模式切换 → 参数设置 → 提交 → 轮询
   * @param {Object} params
   * @param {string} params.prompt - 提示词
   * @param {Array<{path: string, type: 'image' | 'video'}>} params.materials - 本地素材文件
   * @param {Array} params.metaList - 结构化的引用列表（可选）
   * @param {string} params.model - 模型名称
   * @param {number} params.duration - 时长（秒）
   * @param {string} params.aspectRatio - 画面比例
   */
  async runStructuredTask({ prompt, materials, metaList, model, duration, aspectRatio }) {
    console.log('[自动化] 开始结构化任务（API模式）:', {
      prompt: (prompt || '').slice(0, 60),
      materialCount: (materials || []).length,
      model, duration, aspectRatio,
    });

    // Step 1: 导航到生成页面
    this._emit('progress', { stage: 'navigating', message: '🌐 正在打开即梦生成页...' });
    await this.navigateToGenerate();
    await randomDelay(1000, 2000);

    // Step 2: 切换到 Seedance 全能参考模式
    this._emit('progress', { stage: 'mode-switch', message: '🔄 正在切换模式...' });
    await this.switchToSeedanceMode();
    await randomDelay(1000, 2000);

    // Step 3: 选择模型（如果指定）
    if (model) {
      this._emit('progress', { stage: 'select-model', message: `🎯 选择模型: ${model}` });
      await this.selectModel(model);
      await randomDelay(500, 1000);
    }

    // Step 4: API 上传素材（替代 DOM 上传）
    const uploadResults = [];
    if (materials && materials.length > 0) {
      this._emit('progress', { stage: 'uploading', message: `📤 正在上传素材... (0/${materials.length})` });
      for (let i = 0; i < materials.length; i++) {
        const mat = materials[i];
        let result;
        try {
          if (mat.type === 'image') {
            result = await this.uploadImage(mat.path);
          } else if (mat.type === 'video') {
            result = await this.uploadVideo(mat.path);
          } else {
            console.warn('[自动化] 未知素材类型:', mat.type);
            continue;
          }
          if (result && result.success) {
            uploadResults.push({ ...mat, ...result });
            this._emit('progress', {
              stage: 'uploading',
              message: `📤 已上传 ${i + 1}/${materials.length} (${mat.type === 'image' ? '🖼️' : '🎬'} ${mat.path.split('/').pop()})`,
            });
          } else {
            console.error('[自动化] 上传失败:', mat.path, result?.error);
            this._emit('progress', {
              stage: 'upload-error',
              message: `⚠️ 上传失败: ${mat.path.split('/').pop()} - ${result?.error || '未知错误'}`,
            });
          }
        } catch (e) {
          console.error('[自动化] 上传异常:', mat.path, e.message);
          this._emit('progress', {
            stage: 'upload-error',
            message: `⚠️ 上传异常: ${mat.path.split('/').pop()} - ${e.message}`,
          });
        }
      }
    }

    // Step 5: 构造 prompt（用户输入的 prompt 已经包含「图片1」「视频1」引用，直接使用）
    // 无素材时 fallback 到 DOM 方式填入提示词
    if (prompt && uploadResults.length === 0 && (!materials || materials.length === 0)) {
      await this.setPrompt(prompt);
      await randomDelay(500, 1000);
    }

    // Step 6: 构造 draft_content 并 API 提交
    this._emit('progress', { stage: 'submitting', message: '🤖 正在提交到即梦...' });
    const materialsForDraft = uploadResults.map((r) => ({
      type: r.type,
      storeUri: r.storeUri,
      vid: r.vid,
    }));
    const draftContent = this.buildDraftContent({
      materials: materialsForDraft,
      metaList: metaList || null,
      options: { prompt, model, duration, aspectRatio },
    });
    const submitResult = await this.submitGeneration({ draftContent, options: { model } });
    console.log('[自动化] 任务已提交, taskId:', submitResult.taskId);
    this._emit('progress', { stage: 'submitted', message: `✅ 提交成功，taskId: ${submitResult.taskId}` });

    // Step 7: 主动轮询任务状态
    this._emit('progress', { stage: 'generating', message: '⏳ 生成中，预计需要1-3分钟...' });
    const pollResult = await this.pollTaskStatus(submitResult.taskId, {
      timeout: 600000,
      interval: 5000,
    });

    if (pollResult.success && pollResult.status === 'completed') {
      this._emit('progress', { stage: 'completed', message: '🎬 生成完成！' });
      // 解析结果并 emit
      if (pollResult.data) {
        const parsed = parseItem(pollResult.data);
        if (parsed) {
          this._emit('result', parsed);
          this.results.unshift(parsed);
        }
      }
    } else if (pollResult.status === 'timeout') {
      this._emit('progress', { stage: 'timeout', message: '⏰ 生成超时，请稍后查看结果' });
    } else {
      this._emit('progress', { stage: 'error', message: `❌ 生成失败: ${pollResult.error || '未知错误'}` });
    }

    return {
      success: pollResult.success,
      taskId: submitResult.taskId,
      message: pollResult.success
        ? '结构化任务已完成（API 上传 + API 提交 + 轮询）'
        : `结构化任务${pollResult.status === 'timeout' ? '超时' : '失败'}: ${pollResult.error || ''}`,
      result: pollResult.data,
    };
  }

  // ===== 清理 =====
  destroy() {
    this.stopDomPolling();
    this.listeners = [];
    this.taskQueue = [];
    this.processing = false;
  }
}

module.exports = { AutomationService, parseItem, parseApiResponse, getLargestUrl, MODEL_MAP, ASPECT_RATIOS, JIMENG_GENERATE_URL };
