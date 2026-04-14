import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store';

beforeEach(() => {
  localStorage.clear();
  // Reset store to initial state
  useStore.setState({
    tasks: [],
    history: [],
    usage: {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      totalApiTokens: 0,
      todayTasks: 0,
      lastResetDate: new Date().toISOString().slice(0, 10),
    },
  });
});

describe('Task Management', () => {
  const mockTask = {
    id: 'task_1',
    prompt: '一个女孩在海边跳舞',
    status: 'pending' as const,
    model: 'seedance_2.0_fast',
    duration: 5,
    materials: [],
    createdAt: Date.now(),
    retryCount: 0,
  };

  it('addTask adds a task to the list', () => {
    const { addTask } = useStore.getState();
    addTask(mockTask);
    expect(useStore.getState().tasks).toHaveLength(1);
    expect(useStore.getState().tasks[0].prompt).toBe('一个女孩在海边跳舞');
  });

  it('updateTask updates task properties', () => {
    const { addTask, updateTask } = useStore.getState();
    addTask(mockTask);
    updateTask('task_1', { status: 'generating', progress: 50 });
    const task = useStore.getState().tasks[0];
    expect(task.status).toBe('generating');
    expect(task.progress).toBe(50);
  });

  it('removeTask removes a task by id', () => {
    const { addTask, removeTask } = useStore.getState();
    addTask(mockTask);
    addTask({ ...mockTask, id: 'task_2', prompt: '另一个任务' });
    expect(useStore.getState().tasks).toHaveLength(2);
    removeTask('task_1');
    expect(useStore.getState().tasks).toHaveLength(1);
    expect(useStore.getState().tasks[0].id).toBe('task_2');
  });

  it('retryTask resets status to pending and increments retryCount', () => {
    const { addTask, updateTask, retryTask } = useStore.getState();
    addTask({ ...mockTask, status: 'failed', error: '超时' });
    retryTask('task_1');
    const task = useStore.getState().tasks[0];
    expect(task.status).toBe('pending');
    expect(task.error).toBeUndefined();
    expect(task.retryCount).toBe(1);
  });
});

describe('Task Filtering', () => {
  beforeEach(() => {
    const { addTask } = useStore.getState();
    addTask({ id: 't1', prompt: '任务1', status: 'generating', model: 's', duration: 5, materials: [], createdAt: Date.now(), retryCount: 0 });
    addTask({ id: 't2', prompt: '任务2', status: 'completed', model: 's', duration: 5, materials: [], createdAt: Date.now(), retryCount: 0 });
    addTask({ id: 't3', prompt: '任务3', status: 'failed', model: 's', duration: 5, materials: [], createdAt: Date.now(), retryCount: 0 });
    addTask({ id: 't4', prompt: '任务4', status: 'pending', model: 's', duration: 5, materials: [], createdAt: Date.now(), retryCount: 0 });
  });

  it('filter "active" matches generating/pending/queued tasks', () => {
    const tasks = useStore.getState().tasks;
    const active = tasks.filter(t => ['generating', 'queued', 'pending', 'uploading'].includes(t.status));
    expect(active).toHaveLength(2); // t1(generating) + t4(pending)
  });

  it('filter "completed" matches completed/downloaded tasks', () => {
    const tasks = useStore.getState().tasks;
    const completed = tasks.filter(t => ['completed', 'downloaded'].includes(t.status));
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('t2');
  });

  it('filter "failed" matches failed tasks', () => {
    const tasks = useStore.getState().tasks;
    const failed = tasks.filter(t => t.status === 'failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].id).toBe('t3');
  });
});

describe('localStorage Persistence', () => {
  it('tasks are persisted to localStorage on addTask', () => {
    const { addTask } = useStore.getState();
    addTask({
      id: 'persist_1', prompt: '持久化测试', status: 'pending',
      model: 's', duration: 5, materials: [], createdAt: Date.now(), retryCount: 0,
    });
    const saved = JSON.parse(localStorage.getItem('vidclaw_tasks') || '[]');
    expect(saved).toHaveLength(1);
    expect(saved[0].prompt).toBe('持久化测试');
  });

  it('tasks are persisted to localStorage on updateTask', () => {
    const { addTask, updateTask } = useStore.getState();
    addTask({
      id: 'persist_2', prompt: '更新测试', status: 'pending',
      model: 's', duration: 5, materials: [], createdAt: Date.now(), retryCount: 0,
    });
    updateTask('persist_2', { status: 'completed' });
    const saved = JSON.parse(localStorage.getItem('vidclaw_tasks') || '[]');
    expect(saved[0].status).toBe('completed');
  });

  it('tasks are persisted to localStorage on removeTask', () => {
    const { addTask, removeTask } = useStore.getState();
    addTask({
      id: 'persist_3', prompt: '删除测试', status: 'pending',
      model: 's', duration: 5, materials: [], createdAt: Date.now(), retryCount: 0,
    });
    removeTask('persist_3');
    const saved = JSON.parse(localStorage.getItem('vidclaw_tasks') || '[]');
    expect(saved).toHaveLength(0);
  });
});

describe('History Management', () => {
  const mockHistory = {
    id: 'hist_1',
    prompt: '历史作品',
    model: 'seedance',
    duration: 5,
    resultUrl: 'https://example.com/video.mp4',
    createdAt: Date.now(),
    status: 'completed' as const,
  };

  it('addHistory adds an item', () => {
    const { addHistory } = useStore.getState();
    addHistory(mockHistory);
    expect(useStore.getState().history).toHaveLength(1);
    expect(useStore.getState().history[0].prompt).toBe('历史作品');
  });

  it('addHistory persists to localStorage', () => {
    const { addHistory } = useStore.getState();
    addHistory(mockHistory);
    const saved = JSON.parse(localStorage.getItem('vidclaw_history') || '[]');
    expect(saved).toHaveLength(1);
  });

  it('removeHistory removes by id', () => {
    const { addHistory, removeHistory } = useStore.getState();
    addHistory(mockHistory);
    addHistory({ ...mockHistory, id: 'hist_2', prompt: '第二个' });
    removeHistory('hist_1');
    expect(useStore.getState().history).toHaveLength(1);
    expect(useStore.getState().history[0].id).toBe('hist_2');
  });

  it('addHistory caps at 200 items', () => {
    const { addHistory } = useStore.getState();
    for (let i = 0; i < 210; i++) {
      addHistory({ ...mockHistory, id: `hist_${i}`, prompt: `作品${i}` });
    }
    expect(useStore.getState().history).toHaveLength(200);
  });
});

describe('Usage Statistics', () => {
  it('updateUsage updates stats', () => {
    const { updateUsage } = useStore.getState();
    updateUsage({ totalTasks: 10, completedTasks: 8, failedTasks: 2 });
    const usage = useStore.getState().usage;
    expect(usage.totalTasks).toBe(10);
    expect(usage.completedTasks).toBe(8);
    expect(usage.failedTasks).toBe(2);
  });

  it('updateUsage persists to localStorage', () => {
    const { updateUsage } = useStore.getState();
    updateUsage({ totalTasks: 5 });
    const saved = JSON.parse(localStorage.getItem('vidclaw_usage') || '{}');
    expect(saved.totalTasks).toBe(5);
  });

  it('updateUsage resets todayTasks on new day', () => {
    const { updateUsage } = useStore.getState();
    // Set lastResetDate to yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    updateUsage({ todayTasks: 20, lastResetDate: yesterday });
    // Now update again - todayTasks should reset
    updateUsage({ totalTasks: 1 });
    const usage = useStore.getState().usage;
    expect(usage.todayTasks).toBe(0);
  });
});
