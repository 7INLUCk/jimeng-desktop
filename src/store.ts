import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'result' | 'error' | 'ai-rewrite' | 'download' | 'guide-button' | 'mode-select' | 'batch-confirm' | 'progress';
  data?: any;
}

export interface ResultItem {
  id: string;
  url: string;
  prompt: string;
  generateType: 'video' | 'image';
  thumbUrl: string;
  format: string;
  timestamp: number;
  downloaded?: boolean;
  filepath?: string;
}

export interface QueueTask {
  id: string;
  prompt: string;
  files: string[];
  status: 'pending' | 'processing' | 'submitted' | 'failed';
  error?: string;
}

export interface Settings {
  downloadDir: string;
  autoDownload: boolean;
  apiKey: string;
  model: string;
}

// 结构化任务的素材
export interface TaskMaterial {
  path: string;
  type: 'image' | 'video';
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

// 引导式流程步骤
export type GuidedStep =
  | 'welcome'           // 初始欢迎，等用户确认
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

  // 结果
  results: ResultItem[];

  // 队列
  queueTasks: QueueTask[];
  isProcessingQueue: boolean;

  // 设置
  settings: Settings;
  settingsLoaded: boolean;

  // UI 状态
  activePanel: 'chat' | 'results' | 'settings';

  // 批量任务状态
  taskMode: TaskMode;
  batchTasks: BatchTaskItem[];
  batchInfo: BatchInfo | null;
  batchCollectingData: {
    description: string;
    tasks: BatchTaskItem[];
    currentQuestion: string;
    answeredQuestions: string[];
  } | null;

  // Actions
  setAppState: (state: 'loading' | 'ready') => void;
  setStatusMsg: (msg: string) => void;
  setBrowserReady: (ready: boolean) => void;
  setIsLoggedIn: (loggedIn: boolean | null) => void;
  setGuidedStep: (step: GuidedStep) => void;
  addMessage: (msg: Message) => void;
  setSubmitting: (submitting: boolean) => void;
  setStatusText: (text: string) => void;
  setResults: (results: ResultItem[]) => void;
  addResult: (result: ResultItem) => void;
  markDownloaded: (id: string, filepath: string) => void;
  setQueueTasks: (tasks: QueueTask[]) => void;
  setProcessingQueue: (processing: boolean) => void;
  setSettings: (settings: Partial<Settings>) => void;
  setActivePanel: (panel: 'chat' | 'results' | 'settings') => void;
  // 批量任务 Actions
  setTaskMode: (mode: TaskMode) => void;
  setBatchTasks: (tasks: BatchTaskItem[]) => void;
  setBatchInfo: (info: BatchInfo | null) => void;
  setBatchCollectingData: (data: any | null) => void;
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

  results: [],
  queueTasks: [],
  isProcessingQueue: false,

  settings: {
    downloadDir: '',
    autoDownload: false,
    apiKey: '',
    model: 'xiaomi/mimo-v2-pro',
  },
  settingsLoaded: false,

  activePanel: 'chat',

  // 批量任务初始状态
  taskMode: 'single',
  batchTasks: [],
  batchInfo: null,
  batchCollectingData: null,

  setAppState: (appState) => set({ appState }),
  setStatusMsg: (statusMsg) => set({ statusMsg }),
  setBrowserReady: (browserReady) => set({ browserReady }),
  setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  setGuidedStep: (guidedStep) => set({ guidedStep }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setStatusText: (statusText) => set({ statusText }),
  setResults: (results) => set({ results }),
  addResult: (result) => set((s) => ({ results: [result, ...s.results] })),
  markDownloaded: (id, filepath) =>
    set((s) => ({
      results: s.results.map((r) =>
        r.id === id ? { ...r, downloaded: true, filepath } : r
      ),
    })),
  setQueueTasks: (queueTasks) => set({ queueTasks }),
  setProcessingQueue: (isProcessingQueue) => set({ isProcessingQueue }),
  setSettings: (newSettings) =>
    set((s) => ({ settings: { ...s.settings, ...newSettings } })),
  setActivePanel: (activePanel) => set({ activePanel }),
  
  // 批量任务 Actions
  setTaskMode: (taskMode) => set({ taskMode }),
  setBatchTasks: (batchTasks) => set({ batchTasks }),
  setBatchInfo: (batchInfo) => set({ batchInfo }),
  setBatchCollectingData: (batchCollectingData) => set({ batchCollectingData }),
}));
