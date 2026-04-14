import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'result' | 'error' | 'ai-rewrite' | 'download' | 'guide-button' | 'mode-select' | 'batch-confirm' | 'progress' | 'qr-code' | 'login-error' | 'login-loading' | 'clarification';
  data?: any;
}


export interface Settings {
  downloadDir: string;
  autoDownload: boolean;
}

// 结构化任务的素材
export interface TaskMaterial {
  path: string;
  type: 'image' | 'video' | 'audio';
}

// 结构化任务的 meta 引用项
export interface MetaListItem {
  type: 'material_ref' | 'text';
  idx?: number;
  text?: string;
}

// 批量任务项
export interface BatchTaskItem {
  id: string;
  index: number;
  prompt: string;
  reason: string;
  materials: TaskMaterial[];
  expectedEffect: string;
  duration: number;
  aspectRatio: string;
  model: string;
  status: 'pending' | 'submitted' | 'generating' | 'completed' | 'downloaded' | 'failed';
  outputFile?: string;
  error?: string;
}

// 批量任务元信息
export interface BatchInfo {
  id: string;
  name: string;
  description: string;
  totalTasks: number;
  completedTasks: number;
  status: 'pending' | 'running' | 'completed' | 'stopped';
  createdAt: string;
  downloadDir: string;
}

// 任务模式
export type TaskMode = 'single' | 'batch';

// 发送模式
export type SendMode = 'ai-single' | 'ai-batch' | 'direct';

// 模型配置
export interface ModelConfig {
  key: string;
  label: string;
  benefit: string;
}

// 结构化任务参数
export interface StructuredTaskParams {
  prompt: string;
  materials?: TaskMaterial[];
  metaList?: MetaListItem[];
  model?: string;
  duration?: number;
  aspectRatio?: string;
}

// 上传结果
export interface UploadResult {
  path: string;
  type: string;
  success: boolean;
  storeUri?: string;
  vid?: string;
  crc32?: string;
  error?: string;
}

// ===== 任务管理 =====
export interface TaskRecord {
  id: string;
  prompt: string;
  type?: 'video' | 'image';
  status: 'pending' | 'uploading' | 'queued' | 'generating' | 'completed' | 'failed' | 'downloaded';
  progress?: number;
  queuePosition?: number;
  estimatedMinutes?: number;
  taskId?: string;
  submitId?: string;
  model: string;
  duration: number;
  materials: Array<{ path: string; type: string; storeUri?: string }>;
  resultUrl?: string;
  localPath?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  retryCount: number;
  startTime?: number;
  filePath?: string;
  downloaded?: boolean;
}

export type TaskFilter = 'all' | 'active' | 'completed' | 'failed';

// ===== 作品历史 =====
export interface HistoryItem {
  id: string;
  prompt: string;
  model: string;
  duration: number;
  resultUrl: string;
  thumbnailUrl?: string;
  localPath?: string;
  createdAt: number;
  status: 'completed' | 'downloaded' | 'deleted';
}

// ===== 素材库 =====
export interface SavedMaterial {
  id: string;
  path: string;
  type: 'image' | 'video' | 'audio';
  filename: string;
  storeUri?: string;
  vid?: string;
  thumbnailUrl?: string;
  createdAt: number;
}

// ===== Prompt 模板 =====
export interface PromptTemplate {
  id: string;
  name: string;
  emoji: string;
  prompt: string;
  isPreset: boolean;
}

// ===== 用量统计 =====
export interface UsageStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalApiTokens: number;
  todayTasks: number;
  lastResetDate: string;
}

// 引导式流程步骤
export type GuidedStep =
  | 'welcome'           // 初始欢迎，等用户确认
  | 'checking-login'    // 正在检查登录状态
  | 'opening-browser'   // 正在打开浏览器
  | 'waiting-login'     // 等待用户扫码登录
  | 'logged-in-ready'   // 登录成功，等用户描述需求
  | 'mode-selecting'    // 选择任务模式（单个/批量）
  | 'batch-collecting'  // 收集批量任务信息
  | 'batch-confirming'  // 确认批量任务
  | 'task-drafting'     // AI 正在改写 prompt
  | 'task-confirming'   // 等用户确认任务
  | 'task-executing'    // 正在执行（浏览器自动操作）
  | 'batch-executing'   // 批量任务执行中
  | 'task-done';        // 任务完成

interface AppState {
  // 应用状态
  appState: 'loading' | 'ready';
  statusMsg: string;
  browserReady: boolean;
  isLoggedIn: boolean | null;

  // 引导流程
  guidedStep: GuidedStep;

  // 对话
  messages: Message[];
  isSubmitting: boolean;
  statusText: string;


  // 设置
  settings: Settings;
  settingsLoaded: boolean;

  // UI 状态
  activePanel: 'chat' | 'queue' | 'settings' | 'history';

  // 发送模式 & 批量任务状态
  sendMode: SendMode;
  taskMode: TaskMode;
  batchTasks: BatchTaskItem[];
  batchInfo: BatchInfo | null;

  // 任务管理
  tasks: TaskRecord[];
  highlightedTaskId: string | null;

  // 作品历史
  history: HistoryItem[];
  // 素材库
  materials: SavedMaterial[];
  // Prompt 模板
  templates: PromptTemplate[];
  // 用量统计
  usage: UsageStats;
  // 视频预览
  previewUrl: string | null;
  setPreviewUrl: (url: string | null) => void;

  // 编辑任务状态
  editingTaskIndex: number | null;
  setEditingTaskIndex: (index: number | null) => void;

  // Actions
  setAppState: (state: 'loading' | 'ready') => void;
  setStatusMsg: (msg: string) => void;
  setBrowserReady: (ready: boolean) => void;
  setIsLoggedIn: (loggedIn: boolean | null) => void;
  setGuidedStep: (step: GuidedStep) => void;
  addMessage: (msg: Message) => void;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  setSubmitting: (submitting: boolean) => void;
  setStatusText: (text: string) => void;
  setSettings: (settings: Partial<Settings>) => void;
  setActivePanel: (panel: 'chat' | 'queue' | 'settings' | 'history') => void;
  // 发送模式 & 批量任务 Actions
  setSendMode: (mode: SendMode) => void;
  setTaskMode: (mode: TaskMode) => void;
  setBatchTasks: (tasks: BatchTaskItem[]) => void;
  setBatchInfo: (info: BatchInfo | null) => void;
  // 任务管理 Actions
  addTask: (task: TaskRecord) => void;
  updateTask: (id: string, updates: Partial<TaskRecord>) => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => void;
  deleteTask: (id: string) => void;
  downloadTask: (id: string) => void;
  setHighlightedTaskId: (id: string | null) => void;
  // 作品历史 Actions
  addHistory: (item: HistoryItem) => void;
  removeHistory: (id: string) => void;
  // 素材库 Actions
  addMaterial: (item: SavedMaterial) => void;
  removeMaterial: (id: string) => void;
  // 模板 Actions
  addTemplate: (item: PromptTemplate) => void;
  removeTemplate: (id: string) => void;
  // 用量 Actions
  updateUsage: (updates: Partial<UsageStats>) => void;
}

export const useStore = create<AppState>((set) => ({
  appState: 'loading',
  statusMsg: '正在启动...',
  browserReady: false,
  isLoggedIn: null,

  guidedStep: 'welcome',

  messages: [],
  isSubmitting: false,
  statusText: '',

  settings: {
    downloadDir: '',
    autoDownload: false,
  },
  settingsLoaded: false,

  activePanel: 'chat',

  // 发送模式 & 批量任务初始状态
  sendMode: (() => {
    try { return (localStorage.getItem('vidclaw_send_mode') as SendMode) || 'ai-single'; } catch { return 'ai-single'; }
  })() as SendMode,
  taskMode: 'single',
  batchTasks: [],
  batchInfo: null,
  // 任务管理初始状态
  tasks: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })(),
  highlightedTaskId: null,

  // 作品历史
  history: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })(),
  // 素材库
  materials: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_materials');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })(),
  // Prompt 模板
  templates: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_templates');
      if (saved) return JSON.parse(saved);
    } catch {}
    // 预置模板
    return [
      { id: 'p1', name: '舞蹈视频', emoji: '🕺', prompt: '让 [人物] 跳 [舞蹈风格]', isPreset: true },
      { id: 'p2', name: '换装', emoji: '👗', prompt: '让 [人物] 换上 [衣服]', isPreset: true },
      { id: 'p3', name: '卡点视频', emoji: '🎵', prompt: '根据音乐节奏切换画面', isPreset: true },
      { id: 'p4', name: '风景变换', emoji: '🌅', prompt: '将 [场景] 变成 [风格]', isPreset: true },
      { id: 'p5', name: '对话场景', emoji: '💬', prompt: '两个人进行自然对话', isPreset: true },
    ];
  })(),
  // 用量统计
  usage: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_usage');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalApiTokens: 0,
      todayTasks: 0,
      lastResetDate: new Date().toISOString().slice(0, 10),
    };
  })(),
  // 视频预览
  previewUrl: null,
  setPreviewUrl: (previewUrl) => set({ previewUrl }),

  // 编辑任务状态
  editingTaskIndex: null,
  setEditingTaskIndex: (editingTaskIndex) => set({ editingTaskIndex }),

  setAppState: (appState) => set({ appState }),
  setStatusMsg: (statusMsg) => set({ statusMsg }),
  setBrowserReady: (browserReady) => set({ browserReady }),
  setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  setGuidedStep: (guidedStep) => set({ guidedStep }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (updater) => set((s) => ({ messages: updater(s.messages) })),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setStatusText: (statusText) => set({ statusText }),
  setSettings: (newSettings) =>
    set((s) => ({ settings: { ...s.settings, ...newSettings } })),
  setActivePanel: (activePanel) => set({ activePanel }),
  
  // 作品历史 Actions
  addHistory: (item) => set((s) => {
    const history = [item, ...s.history].slice(0, 200);
    try { localStorage.setItem('vidclaw_history', JSON.stringify(history)); } catch {}
    return { history };
  }),
  removeHistory: (id) => set((s) => {
    const history = s.history.filter(h => h.id !== id);
    try { localStorage.setItem('vidclaw_history', JSON.stringify(history)); } catch {}
    return { history };
  }),
  // 素材库 Actions
  addMaterial: (item) => set((s) => {
    const materials = [item, ...s.materials];
    try { localStorage.setItem('vidclaw_materials', JSON.stringify(materials)); } catch {}
    return { materials };
  }),
  removeMaterial: (id) => set((s) => {
    const materials = s.materials.filter(m => m.id !== id);
    try { localStorage.setItem('vidclaw_materials', JSON.stringify(materials)); } catch {}
    return { materials };
  }),
  // 模板 Actions
  addTemplate: (item) => set((s) => {
    const templates = [...s.templates, item];
    try { localStorage.setItem('vidclaw_templates', JSON.stringify(templates)); } catch {}
    return { templates };
  }),
  removeTemplate: (id) => set((s) => {
    const templates = s.templates.filter(t => t.id !== id);
    try { localStorage.setItem('vidclaw_templates', JSON.stringify(templates)); } catch {}
    return { templates };
  }),
  // 用量 Actions
  updateUsage: (updates) => set((s) => {
    const usage = { ...s.usage, ...updates };
    const today = new Date().toISOString().slice(0, 10);
    if (usage.lastResetDate !== today) {
      usage.todayTasks = 0;
      usage.lastResetDate = today;
    }
    try { localStorage.setItem('vidclaw_usage', JSON.stringify(usage)); } catch {}
    return { usage };
  }),
  
  // 发送模式 & 批量任务 Actions
  setSendMode: (sendMode) => {
    try { localStorage.setItem('vidclaw_send_mode', sendMode); } catch {}
    set({ sendMode });
  },
  setTaskMode: (taskMode) => set({ taskMode }),
  setBatchTasks: (batchTasks) => set({ batchTasks }),
  setBatchInfo: (batchInfo) => set({ batchInfo }),
  // 任务管理 Actions
  addTask: (task) => set((s) => {
    const tasks = [task, ...s.tasks];
    try { localStorage.setItem('vidclaw_tasks', JSON.stringify(tasks)); } catch {}
    return { tasks };
  }),
  updateTask: (id, updates) => set((s) => {
    const tasks = s.tasks.map(t => t.id === id ? { ...t, ...updates } : t);
    try { localStorage.setItem('vidclaw_tasks', JSON.stringify(tasks)); } catch {}
    return { tasks };
  }),
  removeTask: (id) => set((s) => {
    const tasks = s.tasks.filter(t => t.id !== id);
    try { localStorage.setItem('vidclaw_tasks', JSON.stringify(tasks)); } catch {}
    return { tasks };
  }),
  retryTask: (id) => set((s) => {
    const tasks = s.tasks.map(t => t.id === id ? {
      ...t,
      status: 'pending' as const,
      error: undefined,
      progress: undefined,
      retryCount: t.retryCount + 1,
      completedAt: undefined,
    } : t);
    try { localStorage.setItem('vidclaw_tasks', JSON.stringify(tasks)); } catch {}
    return { tasks };
  }),
  deleteTask: (id) => set((s) => {
    const tasks = s.tasks.filter(t => t.id !== id);
    try { localStorage.setItem('vidclaw_tasks', JSON.stringify(tasks)); } catch {}
    return { tasks };
  }),
  downloadTask: async (id) => {
    const task = useStore.getState().tasks.find(t => t.id === id);
    if (!task?.submitId) return;
    try {
      const result = await window.api.downloadTask({ submitId: task.submitId });
      if (result.success && result.filepath) {
        useStore.getState().updateTask(id, { filePath: result.filepath, downloaded: true, status: 'downloaded' });
      }
    } catch (e) {
      console.error('[downloadTask] 失败:', e);
    }
  },
  setHighlightedTaskId: (highlightedTaskId) => set({ highlightedTaskId }),
}));
