import { create } from 'zustand';
import { isRemoteHttpUrl } from './utils/filePath';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'result' | 'error' | 'ai-rewrite' | 'download' | 'guide-button' | 'mode-select' | 'batch-confirm' | 'progress' | 'qr-code' | 'login-error' | 'login-loading' | 'clarification' | 'kling-confirm' | 'skill-confirm' | 'submitted-summary';
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
  queuePosition?: number;
  queueStatus?: string;   // "Generating" | "Queuing" from Dreamina API
  queueLength?: number;
  outputFile?: string;
  error?: string;
  submitId?: string;
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
  queueLength?: number;
  nextPollAt?: number;
  statusMessage?: string;
  estimatedMinutes?: number;
  taskId?: string;
  submitId?: string;
  model: string;
  duration: number;
  aspectRatio?: string;
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

// ===== 技能 =====
export interface SkillTask {
  prompt: string;
  expectedEffect?: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'single' | 'batch';
  model: string;
  duration: number;
  aspectRatio: string;
  tasks: SkillTask[];
  materialSlots?: Array<{ type: 'image' | 'video' | 'audio'; path?: string }>;
  createdAt: number;
  updatedAt: number;
  usedCount: number;
  prevVersion?: {
    tasks: SkillTask[];
    model: string;
    duration: number;
    aspectRatio: string;
    updatedAt: number;
  };
}

// ===== 作品历史 =====
export interface HistoryItem {
  id: string;
  submitId?: string;
  prompt: string;
  model: string;
  duration: number;
  resultUrl: string;
  thumbnailUrl?: string;
  localPath?: string;
  createdAt: number;
  status: 'completed' | 'downloaded' | 'failed' | 'deleted';
}

// ===== 批量任务历史（已完成的批次）=====
export interface BatchHistoryTask {
  index: number;
  prompt: string;
  status: 'completed' | 'downloaded' | 'failed';
  outputFile?: string;
  error?: string;
}

export interface BatchHistoryRecord {
  id: string;
  name: string;
  description: string;
  model: string;
  duration: number;
  aspectRatio: string;
  sharedMaterials: Array<{ path: string; type: 'image' | 'video' | 'audio' }>;
  totalTasks: number;
  completedTasks: number;
  tasks: BatchHistoryTask[];
  createdAt: number;
  completedAt: number;
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

// ===== 鉴权 =====
export interface AuthUser {
  email: string;
  isInternal: boolean;
  loginAt: number;
}

// ===== 积分 =====
export interface CreditTransaction {
  id: string;
  type: 'grant' | 'add' | 'deduct';
  amount: number;
  description: string;
  balanceAfter: number;
  createdAt: number;
}

export interface CreditsState {
  balance: number;
  transactions: CreditTransaction[];
}

function computeCreditsBalanceFromTransactions(transactions: CreditTransaction[]): number {
  return transactions.reduce((sum, tx) => {
    if (tx.type === 'deduct') return sum - tx.amount;
    return sum + tx.amount;
  }, 0);
}

function normalizeCreditsState(credits: CreditsState, auth: AuthUser | null): CreditsState {
  if (!auth?.isInternal || !credits.transactions.length) return credits;
  const expectedBalance = computeCreditsBalanceFromTransactions(credits.transactions);
  if (expectedBalance < 0 || expectedBalance === credits.balance) return credits;
  return { ...credits, balance: expectedBalance };
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
  activePanel: 'chat' | 'queue' | 'settings' | 'history' | 'skills' | 'subscription' | 'works';

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
  // 批量任务历史
  batchHistory: BatchHistoryRecord[];
  // 素材库
  materials: SavedMaterial[];
  // 技能
  skills: Skill[];
  activeSkill: Skill | null;
  // 用量统计
  usage: UsageStats;
  // 鉴权 & 积分
  auth: AuthUser | null;
  credits: CreditsState;
  setAuth: (auth: AuthUser | null) => void;
  deductCredits: (amount: number, description: string) => boolean;
  addCredits: (amount: number, description: string) => void;
  syncBalance: (balance: number) => void;
  reconcileCreditsBalance: () => void;
  jimengBalance: number;
  setJimengBalance: (balance: number) => void;

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
  setActivePanel: (panel: 'chat' | 'queue' | 'settings' | 'history' | 'skills' | 'subscription' | 'works') => void;
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
  updateHistory: (id: string, updates: Partial<HistoryItem>) => void;
  removeHistory: (id: string) => void;
  // 批量任务历史 Actions
  addBatchHistory: (record: BatchHistoryRecord) => void;
  removeBatchHistory: (id: string) => void;
  // 素材库 Actions
  addMaterial: (item: SavedMaterial) => void;
  removeMaterial: (id: string) => void;
  // 技能 Actions
  addSkill: (skill: Skill) => void;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  deleteSkill: (id: string) => void;
  setActiveSkill: (skill: Skill | null) => void;
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
    autoDownload: true,
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
  // 任务管理初始状态（重启时把孤儿任务标记为失败）
  tasks: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_tasks');
      if (!saved) return [];
      const ACTIVE = new Set(['pending', 'queued', 'generating', 'uploading']);
      return (JSON.parse(saved) as TaskRecord[]).map(t =>
        ACTIVE.has(t.status)
          ? { ...t, status: 'failed' as const, error: '应用重启，任务中断，请重试' }
          : t
      );
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
  batchHistory: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_batch_history');
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
  // 技能
  skills: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_skills');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })(),
  activeSkill: null,
  // 鉴权 & 积分
  auth: (() => {
    try {
      const saved = localStorage.getItem('vidclaw_auth');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  })(),
  credits: (() => {
    let auth: AuthUser | null = null;
    try {
      const savedAuth = localStorage.getItem('vidclaw_auth');
      auth = savedAuth ? JSON.parse(savedAuth) : null;
    } catch {}
    try {
      const saved = localStorage.getItem('vidclaw_credits');
      const credits = saved ? JSON.parse(saved) : { balance: 0, transactions: [] };
      return normalizeCreditsState(credits, auth);
    } catch { return { balance: 0, transactions: [] }; }
  })(),
  jimengBalance: 0,
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
  updateHistory: (id, updates) => set((s) => {
    const history = s.history.map(h => h.id === id ? { ...h, ...updates } : h);
    try { localStorage.setItem('vidclaw_history', JSON.stringify(history)); } catch {}
    return { history };
  }),
  removeHistory: (id) => set((s) => {
    const history = s.history.filter(h => h.id !== id);
    try { localStorage.setItem('vidclaw_history', JSON.stringify(history)); } catch {}
    return { history };
  }),
  addBatchHistory: (record) => set((s) => {
    const batchHistory = [record, ...s.batchHistory].slice(0, 100);
    try { localStorage.setItem('vidclaw_batch_history', JSON.stringify(batchHistory)); } catch {}
    return { batchHistory };
  }),
  removeBatchHistory: (id) => set((s) => {
    const batchHistory = s.batchHistory.filter(b => b.id !== id);
    try { localStorage.setItem('vidclaw_batch_history', JSON.stringify(batchHistory)); } catch {}
    return { batchHistory };
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
  // 技能 Actions
  addSkill: (skill) => set((s) => {
    const skills = [skill, ...s.skills];
    try { localStorage.setItem('vidclaw_skills', JSON.stringify(skills)); } catch {}
    return { skills };
  }),
  updateSkill: (id, updates) => set((s) => {
    const skills = s.skills.map(sk => sk.id === id ? { ...sk, ...updates } : sk);
    try { localStorage.setItem('vidclaw_skills', JSON.stringify(skills)); } catch {}
    return { skills };
  }),
  deleteSkill: (id) => set((s) => {
    const skills = s.skills.filter(sk => sk.id !== id);
    try { localStorage.setItem('vidclaw_skills', JSON.stringify(skills)); } catch {}
    return { skills };
  }),
  setActiveSkill: (activeSkill) => set({ activeSkill }),
  // 鉴权 Actions
  setAuth: (auth) => set((s) => {
    try { localStorage.setItem('vidclaw_auth', auth ? JSON.stringify(auth) : ''); } catch {}
    const credits = normalizeCreditsState(s.credits, auth);
    try { localStorage.setItem('vidclaw_credits', JSON.stringify(credits)); } catch {}
    return { auth, credits };
  }),
  syncBalance: (balance) => set((s) => {
    const credits = { ...s.credits, balance };
    try { localStorage.setItem('vidclaw_credits', JSON.stringify(credits)); } catch {}
    return { credits };
  }),
  reconcileCreditsBalance: () => set((s) => {
    const credits = normalizeCreditsState(s.credits, s.auth);
    if (credits.balance === s.credits.balance) return {};
    try { localStorage.setItem('vidclaw_credits', JSON.stringify(credits)); } catch {}
    return { credits };
  }),
  setJimengBalance: (jimengBalance) => set({ jimengBalance }),
  deductCredits: (amount, description) => {
    const state = useStore.getState();
    if (state.credits.balance < amount) return false;
    const balanceAfter = state.credits.balance - amount;
    const tx: CreditTransaction = {
      id: 'tx_' + Date.now(),
      type: 'deduct',
      amount,
      description,
      balanceAfter,
      createdAt: Date.now(),
    };
    const credits = { balance: balanceAfter, transactions: [tx, ...state.credits.transactions].slice(0, 100) };
    try { localStorage.setItem('vidclaw_credits', JSON.stringify(credits)); } catch {}
    set({ credits });
    return true;
  },
  addCredits: (amount, description) => {
    const state = useStore.getState();
    const balanceAfter = state.credits.balance + amount;
    const tx: CreditTransaction = {
      id: 'tx_' + Date.now(),
      type: amount >= 1000 ? 'grant' : 'add',
      amount,
      description,
      balanceAfter,
      createdAt: Date.now(),
    };
    const credits = { balance: balanceAfter, transactions: [tx, ...state.credits.transactions].slice(0, 100) };
    try { localStorage.setItem('vidclaw_credits', JSON.stringify(credits)); } catch {}
    set({ credits });
  },
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
    if (!task) return;
    const downloadArgs = isRemoteHttpUrl(task.resultUrl)
      ? { url: task.resultUrl, prompt: task.prompt, model: task.model, duration: task.duration }
      : task.submitId
        ? { submitId: task.submitId, prompt: task.prompt, model: task.model, duration: task.duration }
        : null;
    if (!downloadArgs) return;
    try {
      const result = await window.api.downloadTask(downloadArgs);
      if (result.success && result.filePath) {
        useStore.getState().updateTask(id, {
          filePath: result.filePath,
          localPath: result.filePath,
          resultUrl: result.filePath,
          downloaded: true,
          status: 'downloaded',
        });
        const matchingHistory = useStore.getState().history.find(h =>
          h.submitId === task.submitId ||
          (task.resultUrl && h.resultUrl === task.resultUrl)
        );
        if (matchingHistory) {
          useStore.getState().updateHistory(matchingHistory.id, {
            localPath: result.filePath,
            resultUrl: result.filePath,
            status: 'downloaded',
          });
        }
      }
    } catch (e) {
      console.error('[downloadTask] 失败:', e);
    }
  },
  setHighlightedTaskId: (highlightedTaskId) => set({ highlightedTaskId }),
}));
