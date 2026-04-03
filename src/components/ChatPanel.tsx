import { useState, useRef, useEffect } from 'react';
import { Send, Upload, X, Download, Loader2, CheckCircle, RefreshCw, Settings2, Layers, FileStack, Sparkles, Globe, Type, Video, ChevronDown, ChevronUp, AlertTriangle, ArrowUp } from 'lucide-react';
import { useStore, type Message, type GuidedStep, type TaskMaterial, type TaskMode, type BatchTaskItem } from '../store';

// ── Mode Select Card (选择单个/批量) ──
function ModeSelectCard({ onSelect }: { onSelect: (mode: TaskMode) => void }) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl overflow-hidden max-w-[85%] animate-fade-in-up">
      <div className="flex">
        <div className="w-1 bg-accent-gradient flex-shrink-0" />
        <div className="p-4 flex-1">
          <p className="text-xs text-accent font-medium mb-3 flex items-center gap-1.5">
            <span>🎯</span> 选择任务模式
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSelect('single')}
              className="flex flex-col items-center gap-2 p-4 bg-surface-3 hover:bg-border rounded-xl transition-all hover:-translate-y-0.5"
            >
              <FileStack size={24} className="text-brand" />
              <span className="text-sm font-medium">单个任务</span>
              <span className="text-xs text-text-muted">快速生成一个视频</span>
            </button>
            <button
              onClick={() => onSelect('batch')}
              className="flex flex-col items-center gap-2 p-4 bg-surface-3 hover:bg-border rounded-xl transition-all hover:-translate-y-0.5"
            >
              <Layers size={24} className="text-accent" />
              <span className="text-sm font-medium">批量任务</span>
              <span className="text-xs text-text-muted">批量生成多个视频</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Batch Confirm Card (批量任务确认表单) ──
function BatchConfirmCard({
  tasks,
  batchName,
  description,
  onConfirm,
  onEdit,
  onTaskEdit,
}: {
  tasks: BatchTaskItem[];
  batchName: string;
  description: string;
  onConfirm: () => void;
  onEdit: () => void;
  onTaskEdit: (index: number) => void;
}) {
  return (
    <div className="bg-surface-2 border border-border rounded-xl overflow-hidden max-w-[90%] animate-fade-in-up">
      <div className="flex">
        <div className="w-1 bg-accent-gradient flex-shrink-0" />
        <div className="p-4 flex-1 max-h-[400px] overflow-y-auto">
          <p className="text-xs text-accent font-medium mb-2 flex items-center gap-1.5">
            <span>📦</span> 批量任务确认
          </p>
          <p className="text-sm text-text-primary font-medium mb-1">{batchName}</p>
          {description && <p className="text-xs text-text-secondary mb-3">{description}</p>}
          
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">
            共 {tasks.length} 个任务
          </p>

          {/* 任务列表 */}
          <div className="space-y-2 mb-4">
            {tasks.map((task, i) => (
              <div key={task.id} className="bg-surface-3 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary mb-1">
                      #{i + 1} {task.expectedEffect || '视频生成'}
                    </p>
                    <p className="text-[11px] text-text-secondary line-clamp-2">{task.prompt}</p>
                    {task.reason && (
                      <p className="text-[10px] text-text-muted mt-1">💡 {task.reason}</p>
                    )}
                  </div>
                  <button
                    onClick={() => onTaskEdit(i)}
                    className="text-[10px] text-brand hover:underline shrink-0"
                  >
                    编辑
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-text-muted">
                  <span>{task.duration}s</span>
                  <span>·</span>
                  <span>{task.aspectRatio}</span>
                  {task.materials?.length > 0 && (
                    <>
                      <span>·</span>
                      <span>{task.materials.length} 素材</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-gradient hover:shadow-[var(--shadow-brand)] text-white text-xs font-medium rounded-lg transition-all hover:-translate-y-0.5"
            >
              <CheckCircle size={14} />
              确认全部提交
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all"
            >
              <RefreshCw size={14} />
              重新描述
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty State Card (问题2：空态引导) ──
function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  const examples = [
    '一个女孩在海边跳舞，夕阳背景，浪漫风格',
    '帮我把这张照片变成 5 秒的短视频',
    '美食探店 vlog 片头，热气腾腾的火锅特写',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 animate-fade-in">
      <div className="max-w-md w-full text-center">
        {/* Logo + Title */}
        <div className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center mx-auto mb-5 shadow-[var(--shadow-brand-lg)]">
          <Sparkles size={24} className="text-white" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1.5">VidClaw - 说人话，出视频</h2>
        <p className="text-sm text-text-muted mb-8">描述你想要的视频，AI 帮你生成</p>

        {/* Example prompts */}
        <div className="space-y-2.5">
          {examples.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onPromptClick(prompt)}
              className="w-full text-left px-4 py-3 bg-surface-2 hover:bg-surface-3 border border-border-subtle hover:border-border rounded-xl text-sm text-text-secondary hover:text-text-primary transition-all duration-150 group"
            >
              <span className="text-text-muted mr-2 text-xs">{i + 1}.</span>
              {prompt}
              <span className="float-right opacity-0 group-hover:opacity-100 transition-opacity text-brand text-xs mt-0.5">
                点击使用 →
              </span>
            </button>
          ))}
        </div>

        {/* Usage hint */}
        <p className="text-[11px] text-text-disabled mt-6">
          💡 登录即梦后，直接输入描述即可生成视频
        </p>
      </div>
    </div>
  );
}

// ── Onboarding Overlay (问题6：新手引导) ──
function OnboardingOverlay({ onDismiss, isLoggedIn }: { onDismiss: () => void; isLoggedIn: boolean }) {
  const loggedInSteps = [
    { icon: <Type size={22} />, title: '输入描述', desc: '用自然语言描述你想生成的视频' },
    { icon: <Video size={22} />, title: '等待出片', desc: 'AI 自动优化并生成视频' },
  ];

  const loggedOutSteps = [
    { icon: <Globe size={22} />, title: '登录即梦', desc: '打开浏览器，扫码登录即梦账号' },
    { icon: <Type size={22} />, title: '输入描述', desc: '用自然语言描述你想生成的视频' },
    { icon: <Video size={22} />, title: '等待出片', desc: 'AI 自动优化并生成视频' },
  ];

  const steps = isLoggedIn ? loggedInSteps : loggedOutSteps;
  const stepCount = steps.length;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 animate-overlay-in">
      <div className="bg-surface-1 border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-[var(--shadow-elevated)] animate-card-pop">
        <h3 className="text-base font-semibold text-text-primary text-center mb-1">欢迎使用 VidClaw</h3>
        <p className="text-xs text-text-muted text-center mb-6">{stepCount} 步开始创作</p>

        <div className="space-y-4 mb-8">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center text-brand shrink-0">
                {step.icon}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{i + 1}. {step.title}</p>
                <p className="text-xs text-text-muted">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 bg-brand-gradient text-white text-sm font-medium rounded-xl hover:shadow-[var(--shadow-brand)] transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          开始使用
        </button>
        <button
          onClick={onDismiss}
          className="w-full mt-2 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          跳过
        </button>
      </div>
    </div>
  );
}

// ── Progress Message (问题5：进度消息样式增强) ──
function ProgressMessage({ msg }: { msg: Message }) {
  const data = msg.data as any;
  const progressType = data?.progressType || 'generating';
  const percent = data?.percent;
  const error = data?.error;

  if (progressType === 'uploading') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-surface-2 border border-border-subtle rounded-xl px-4 py-3 max-w-xs">
          <div className="flex items-center gap-2.5">
            <ArrowUp size={16} className="text-brand animate-upload-bounce" />
            <span className="text-xs text-text-secondary">{msg.content || '正在上传素材...'}</span>
          </div>
        </div>
      </div>
    );
  }

  if (progressType === 'completed') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-success/10 border border-success/20 rounded-xl px-4 py-3 max-w-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle size={16} className="text-success animate-check-pop" />
            <span className="text-xs text-success font-medium">{msg.content || '生成完成'}</span>
          </div>
        </div>
      </div>
    );
  }

  if (progressType === 'failed') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 max-w-xs animate-shake">
          <div className="flex items-center gap-2.5 mb-2">
            <AlertTriangle size={16} className="text-error" />
            <span className="text-xs text-error font-medium">{msg.content || '生成失败'}</span>
          </div>
          {error && <p className="text-[11px] text-error/70 mb-2">{error}</p>}
          <button
            onClick={data?.onRetry}
            className="text-[11px] text-error hover:text-error/80 font-medium underline underline-offset-2"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // Default: generating
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-surface-2 border border-border-subtle rounded-xl px-4 py-3 max-w-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-text-secondary">{msg.content || '正在生成...'}</span>
          {percent !== undefined && (
            <span className="text-[11px] text-brand font-mono font-medium">{percent}%</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Parameter Panel (Card-style layout) ──
function ParameterPanel({
  model, setModel, duration, setDuration, aspectRatio, setAspectRatio, visible
}: {
  model: string;
  setModel: (m: string) => void;
  duration: number;
  setDuration: (d: number) => void;
  aspectRatio: string;
  setAspectRatio: (r: string) => void;
  visible: boolean;
}) {
  if (!visible) return null;

  const models = [
    { value: 'seedance_2.0_fast', label: 'Fast' },
    { value: 'seedance_2.0', label: 'Standard' },
  ];
  const durations = [4, 5, 6, 8, 10, 12, 15];
  const ratios = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];

  return (
    <div className={`px-6 border-t border-border-subtle bg-surface-1 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out ${visible ? 'py-3 max-h-[200px] opacity-100' : 'py-0 max-h-0 opacity-0'}`}>
      <div className="grid grid-cols-3 gap-4">
        <ParamSection label="模型">
          {models.map((m) => (
            <ParamChip
              key={m.value}
              active={model === m.value}
              onClick={() => setModel(m.value)}
            >
              {m.label}
            </ParamChip>
          ))}
        </ParamSection>
        <ParamSection label="时长">
          {durations.map((d) => (
            <ParamChip
              key={d}
              active={duration === d}
              onClick={() => setDuration(d)}
            >
              {d}s
            </ParamChip>
          ))}
        </ParamSection>
        <ParamSection label="比例">
          {ratios.map((r) => (
            <ParamChip
              key={r}
              active={aspectRatio === r}
              onClick={() => setAspectRatio(r)}
            >
              {r}
            </ParamChip>
          ))}
        </ParamSection>
      </div>
    </div>
  );
}

function ParamSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-text-muted uppercase tracking-wider mb-2 block font-medium">{label}</label>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ParamChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2.5 py-1.5 text-[11px] rounded-md transition-all duration-150 font-medium
        ${active
          ? 'bg-brand text-white shadow-[var(--shadow-brand)]'
          : 'bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary'
        }
      `}
    >
      {children}
    </button>
  );
}

// ── Guide Button (gradient + hover animation) ──
function GuideButton({ label, onClick, disabled, icon }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-gradient hover:shadow-[var(--shadow-brand-lg)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
    >
      {icon}
      {label}
    </button>
  );
}

// ── Confirm Card (left accent band + clean layout) ──
function ConfirmCard({ 
  task, onConfirm, onEdit, hasFiles, selectedModel, selectedDuration, selectedRatio,
  materials, onDurationChange, onRatioChange 
}: {
  task: any;
  onConfirm: () => void;
  onEdit: () => void;
  hasFiles?: boolean;
  selectedModel?: string;
  selectedDuration?: number;
  selectedRatio?: string;
  materials?: { images: any[]; videos: any[]; audios: any[] };
  onDurationChange?: (d: number) => void;
  onRatioChange?: (r: string) => void;
}) {
  const modelLabels: Record<string, string> = {
    'seedance_2.0_fast': 'Seedance 2.0 Fast',
    'seedance_2.0': 'Seedance 2.0',
  };

  const durations = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const ratios = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];

  // 所有素材合并
  const allMaterials = [
    ...(materials?.images || []),
    ...(materials?.videos || []),
    ...(materials?.audios || []),
  ];

  return (
    <div className="bg-surface-2 border border-border rounded-xl overflow-hidden max-w-[85%] animate-fade-in-up">
      {/* Left accent band */}
      <div className="flex">
        <div className="w-1 bg-brand-gradient flex-shrink-0" />
        <div className="p-4 flex-1">
          <p className="text-xs text-brand font-medium mb-2 flex items-center gap-1.5">
            <span>✨</span> AI 优化后的提示词
          </p>
          <p className="text-sm text-text-primary leading-relaxed mb-3">{task.prompt}</p>

          {/* 改写理由 */}
          {task.reason && (
            <p className="text-xs text-text-secondary mb-3 bg-surface-3 rounded-lg px-3 py-2 border-l-2 border-accent">
              💡 <span className="font-medium">改写理由：</span>{task.reason}
            </p>
          )}

          {/* 素材映射表 */}
          {allMaterials.length > 0 && (
            <div className="mb-3 bg-surface-3 rounded-lg px-3 py-2.5 border border-border-subtle">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <span>📋</span> 素材映射
              </p>
              <div className="space-y-1.5">
                {(materials?.images || []).map((m, i) => (
                  <p key={`img-${i}`} className="text-xs text-text-secondary flex items-center gap-1.5">
                    <span>🖼️</span>
                    <span className="text-accent font-medium">@图片{i + 1}</span>
                    <span className="text-text-muted">→</span>
                    <span>你的第{i + 1}张图片</span>
                    <span className="text-text-disabled">（{m.name?.replace(/^图片\d+$/, '') || m.name}）</span>
                  </p>
                ))}
                {(materials?.videos || []).map((m, i) => (
                  <p key={`vid-${i}`} className="text-xs text-text-secondary flex items-center gap-1.5">
                    <span>🎬</span>
                    <span className="text-accent font-medium">@视频{i + 1}</span>
                    <span className="text-text-muted">→</span>
                    <span>你的第{i + 1}个视频</span>
                    <span className="text-text-disabled">（{m.name?.replace(/^视频\d+$/, '') || m.name}）</span>
                  </p>
                ))}
                {(materials?.audios || []).map((m, i) => (
                  <p key={`aud-${i}`} className="text-xs text-text-secondary flex items-center gap-1.5">
                    <span>🎵</span>
                    <span className="text-accent font-medium">@音频{i + 1}</span>
                    <span className="text-text-muted">→</span>
                    <span>你的第{i + 1}个音频</span>
                    <span className="text-text-disabled">（{m.name?.replace(/^音频\d+$/, '') || m.name}）</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 素材预览 */}
          {allMaterials.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">已上传素材（点击预览）</p>
              <div className="flex flex-wrap gap-2">
                {allMaterials.map((m, i) => (
                  <FilePreviewChip key={i} material={m} />
                ))}
              </div>
            </div>
          )}

          {/* 参数选择器 */}
          {hasFiles && (
            <div className="mb-3 space-y-2">
              {/* 时长选择 */}
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">时长</p>
                <div className="flex flex-wrap gap-1">
                  {durations.map((d) => (
                    <button
                      key={d}
                      onClick={() => onDurationChange?.(d)}
                      className={`px-2 py-1 text-[11px] rounded-md transition-all ${
                        selectedDuration === d
                          ? 'bg-brand text-white'
                          : 'bg-surface-3 text-text-secondary hover:bg-border'
                      }`}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>
              {/* 比例选择 */}
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">画幅比例</p>
                <div className="flex flex-wrap gap-1">
                  {ratios.map((r) => (
                    <button
                      key={r}
                      onClick={() => onRatioChange?.(r)}
                      className={`px-2 py-1 text-[11px] rounded-md transition-all ${
                        selectedRatio === r
                          ? 'bg-brand text-white'
                          : 'bg-surface-3 text-text-secondary hover:bg-border'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 标签展示（无素材时） */}
          {!hasFiles && (
            <div className="flex items-center gap-2 text-xs text-text-secondary mb-4 flex-wrap">
              <span className="bg-surface-3 rounded-md px-2 py-0.5 font-mono">{task.type || 'video'}</span>
              {task.duration && <span className="bg-surface-3 rounded-md px-2 py-0.5 font-mono">{task.duration}s</span>}
              <span className="bg-surface-3 rounded-md px-2 py-0.5 font-mono">{task.aspectRatio || '16:9'}</span>
              {task.style && <span className="bg-surface-3 rounded-md px-2 py-0.5">{task.style}</span>}
            </div>
          )}

          {hasFiles && (
            <p className="text-[10px] text-accent mb-3">⚡ 结构化模式：素材将通过 API 直接上传</p>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-gradient hover:shadow-[var(--shadow-brand)] text-white text-xs font-medium rounded-lg transition-all duration-150 hover:-translate-y-0.5"
            >
              <CheckCircle size={14} />
              确认提交
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs font-medium rounded-lg transition-all duration-150"
            >
              <RefreshCw size={14} />
              重新描述
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── File Preview Chip (点击预览) ──
function FilePreviewChip({ material }: { material: { type: string; name: string; path: string } }) {
  const isImage = material.type === 'image';
  const isVideo = material.type === 'video';
  const isAudio = material.type === 'audio';

  const handlePreview = async () => {
    // 用系统默认程序打开文件
    const result = await window.api.openFile(material.path);
    if (!result.success) {
      console.error('打开文件失败:', result.error);
    }
  };

  return (
    <button
      onClick={handlePreview}
      className="inline-flex items-center gap-1.5 px-2 py-1 bg-surface-3 hover:bg-border rounded-md text-xs transition-all group"
      title={`点击预览: ${material.path}`}
    >
      {isImage && <span className="text-green-400">🖼️</span>}
      {isVideo && <span className="text-blue-400">🎬</span>}
      {isAudio && <span className="text-purple-400">🎵</span>}
      <span className="text-text-secondary group-hover:text-text-primary">{material.name}</span>
      <span className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">👁️</span>
    </button>
  );
}

// ═══════════════════════════════════════════
//  Main ChatPanel
// ═══════════════════════════════════════════
export function ChatPanel() {
  const {
    messages, addMessage, isSubmitting, setSubmitting,
    statusText, setStatusText,
    guidedStep, setGuidedStep,
  } = useStore();

  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [pendingTask, setPendingTask] = useState<any>(null);
  const [loginPollTimer, setLoginPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');
  const [lastFiles, setLastFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Structured task params
  const [selectedModel, setSelectedModel] = useState('seedance_2.0_fast');
  const [selectedDuration, setSelectedDuration] = useState(5);
  const [selectedRatio, setSelectedRatio] = useState('9:16');
  const [showParams, setShowParams] = useState(false);
  const [useStructuredFlow] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('vidclaw_onboarded'));

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Welcome message on first load
  useEffect(() => {
    if (guidedStep === 'welcome' && messages.length === 0) {
      addMessage({
        id: 'welcome',
        role: 'assistant',
        content: '你好！我是即梦视频助手。先帮你打开即梦页面，准备好了吗？',
        timestamp: new Date(),
        type: 'guide-button',
      });
    }
  }, []);

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (loginPollTimer) clearInterval(loginPollTimer);
    };
  }, [loginPollTimer]);

  // ── Guide flow handlers ──
  async function handleReady() {
    addMessage({
      id: Date.now().toString() + '_ready',
      role: 'user',
      content: '准备好了',
      timestamp: new Date(),
    });

    setGuidedStep('opening-browser');
    addMessage({
      id: Date.now().toString() + '_opening',
      role: 'assistant',
      content: '正在打开浏览器...',
      timestamp: new Date(),
    });

    try {
      const result = await window.api.launchBrowser();
      if (!result.success) {
        addMessage({
          id: Date.now().toString() + '_err',
          role: 'assistant',
          content: `❌ 打开浏览器失败: ${result.error || '未知错误'}`,
          timestamp: new Date(),
          type: 'error',
        });
        setGuidedStep('welcome');
        return;
      }

      setGuidedStep('waiting-login');
      addMessage({
        id: Date.now().toString() + '_scan',
        role: 'assistant',
        content: '浏览器已打开，请在弹出的浏览器窗口中扫码登录即梦',
        timestamp: new Date(),
      });

      startLoginPolling();
    } catch (err) {
      addMessage({
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: `❌ 打开浏览器出错: ${err}`,
        timestamp: new Date(),
        type: 'error',
      });
      setGuidedStep('welcome');
    }
  }

  function startLoginPolling() {
    if (loginPollTimer) clearInterval(loginPollTimer);

    const timer = setInterval(async () => {
      try {
        const { loggedIn } = await window.api.checkLogin();
        if (loggedIn) {
          clearInterval(timer);
          setLoginPollTimer(null);
          useStore.getState().setIsLoggedIn(true);

          addMessage({
            id: Date.now().toString() + '_login_ok',
            role: 'assistant',
            content: '✅ 登录成功！正在自动配置视频创作模式...',
            timestamp: new Date(),
          });

          // 登录后自动初始化模式（三步切换）
          try {
            const modeResult = await window.api.initMode();
            if (modeResult.success) {
              setGuidedStep('logged-in-ready');
              addMessage({
                id: Date.now().toString() + '_mode_ok',
                role: 'assistant',
                content: '✅ 视频创作模式已就绪（全能参考）！请描述你想生成的视频。',
                timestamp: new Date(),
                type: 'mode-select',
              });
            } else {
              setGuidedStep('logged-in-ready');
              addMessage({
                id: Date.now().toString() + '_mode_warn',
                role: 'assistant',
                content: `⚠️ 模式自动配置遇到问题: ${modeResult.error || '未知错误'}\n你可以在浏览器中手动选择模式，然后在这里描述需求`,
                timestamp: new Date(),
              });
            }
          } catch (modeErr) {
            setGuidedStep('logged-in-ready');
            addMessage({
              id: Date.now().toString() + '_mode_err',
              role: 'assistant',
              content: `⚠️ 模式自动配置失败: ${modeErr}\n请在浏览器中手动选择模式`,
              timestamp: new Date(),
            });
          }
        }
      } catch { /* silent */ }
    }, 3000);

    setLoginPollTimer(timer);
  }

  async function handleSend() {
    if (!input.trim() || isSubmitting) return;
    if (guidedStep === 'task-confirming') return;

    // ===== 批量任务模式 =====
    if (guidedStep === 'batch-collecting') {
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: input.trim(),
        timestamp: new Date(),
      };
      addMessage(userMsg);
      setInput('');
      setSubmitting(true);
      setStatusText('🧠 AI 正在规划批量任务...');

      try {
        const result = await window.api.prepareBatchTasks(userMsg.content);
        console.log('[批量任务] AI 返回:', result);

        if (!result.success || !result.tasks || result.tasks.length === 0) {
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `❌ ${result.error || '批量任务生成失败，请重试'}`,
            timestamp: new Date(),
            type: 'error',
          });
          setGuidedStep('logged-in-ready');
        } else {
          setGuidedStep('task-confirming');
          addMessage({
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '',
            timestamp: new Date(),
            type: 'batch-confirm',
            data: {
              batchName: result.batchName || '批量任务',
              description: result.description || '',
              tasks: result.tasks,
            },
          });
        }
      } catch (err) {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ 出错了: ${err}`,
          timestamp: new Date(),
          type: 'error',
        });
        setGuidedStep('logged-in-ready');
      } finally {
        setSubmitting(false);
        setStatusText('');
      }
      return;
    }

    // ===== 单个任务模式 =====
    // 构建素材信息（用于 Seedance 模式改写）
    const materials = {
      images: [] as Array<{ type: string; name: string; path: string }>,
      videos: [] as Array<{ type: string; name: string; path: string }>,
      audios: [] as Array<{ type: string; name: string; path: string }>,
    };

    // 按类型分类并命名文件
    let imageIdx = 0, videoIdx = 0, audioIdx = 0;
    selectedFiles.forEach(f => {
      const fileName = f.split('/').pop() || f;
      if (/\.(mp4|mov|avi|webm)$/i.test(f)) {
        videoIdx++;
        materials.videos.push({ type: 'video', name: `视频${videoIdx}`, path: f });
      } else if (/\.(mp3|wav|aac|flac)$/i.test(f)) {
        audioIdx++;
        materials.audios.push({ type: 'audio', name: `音频${audioIdx}`, path: f });
      } else {
        imageIdx++;
        materials.images.push({ type: 'image', name: `图片${imageIdx}`, path: f });
      }
    });

    const hasFiles = selectedFiles.length > 0;
    const fileListDesc = hasFiles 
      ? [...materials.images, ...materials.videos, ...materials.audios].map(m => m.name).join('、')
      : '';

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim() + (hasFiles ? `\n📎 ${fileListDesc}` : ''),
      timestamp: new Date(),
    };

    addMessage(userMsg);
    setLastPrompt(input.trim());
    setLastFiles([...selectedFiles]);
    setInput('');
    setSubmitting(true);
    setIsAiThinking(true);
    setGuidedStep('task-drafting');
    setStatusText('🧠 AI 正在优化提示词...');

    try {
      let result;

      if (hasFiles) {
        // 有素材时使用 Seedance 模式改写
        result = await window.api.prepareTaskForSeedance(userMsg.content, materials);
      } else {
        // 无素材时使用普通改写
        result = await window.api.prepareTask(userMsg.content);
      }

      if (!result.success || !result.task) {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ ${result.error || 'AI 改写失败，请重试'}`,
          timestamp: new Date(),
          type: 'error',
        });
        setGuidedStep('logged-in-ready');
      } else {
        setPendingTask(result.task);
        setGuidedStep('task-confirming');
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          type: 'ai-rewrite',
          data: {
            ...result.task,
            reason: result.task.reason,
            hasFiles,
            selectedModel: hasFiles ? selectedModel : undefined,
            selectedDuration: hasFiles ? selectedDuration : undefined,
            selectedRatio: hasFiles ? selectedRatio : undefined,
            materials: (result as any).materials,
          },
        });
      }
    } catch (err) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ 出错了: ${err}`,
        timestamp: new Date(),
        type: 'error',
      });
      setGuidedStep('logged-in-ready');
    } finally {
      setSubmitting(false);
      setIsAiThinking(false);
      setStatusText('');
    }
  }

  async function handleConfirmTask() {
    if (!pendingTask) return;

    addMessage({
      id: Date.now().toString() + '_confirm',
      role: 'user',
      content: '确认提交',
      timestamp: new Date(),
    });

    setSubmitting(true);
    setGuidedStep('task-executing');
    setStatusText('⏳ 正在提交任务...');
    setSelectedFiles([]);

    try {
      const hasFiles = selectedFiles.length > 0 && useStructuredFlow;

      if (hasFiles) {
        const materials: TaskMaterial[] = selectedFiles.map(f => ({
          path: f,
          type: (/\.(mp4|mov|avi|webm)$/i.test(f) ? 'video' : 'image') as 'image' | 'video',
        }));

        setStatusText('📤 正在上传素材...');
        const result = await window.api.runStructuredTask({
          prompt: pendingTask.prompt,
          materials,
          model: selectedModel,
          duration: selectedDuration,
          aspectRatio: selectedRatio,
        });

        if (result.success) {
          addMessage({
            id: Date.now().toString() + '_submitted',
            role: 'assistant',
            content: `✅ 结构化任务已提交！\n模型: ${selectedModel} | 时长: ${selectedDuration}s | 比例: ${selectedRatio}\n素材: ${selectedFiles.length} 个文件\n结果会自动展示。`,
            timestamp: new Date(),
          });
        } else {
          addMessage({
            id: Date.now().toString() + '_fail',
            role: 'assistant',
            content: `❌ 提交失败: ${result.error}`,
            timestamp: new Date(),
            type: 'error',
          });
        }
      } else {
        const result = await window.api.executeTask(pendingTask);

        if (result.success) {
          addMessage({
            id: Date.now().toString() + '_submitted',
            role: 'assistant',
            content: `✅ 任务已提交！即梦正在生成中，结果会自动展示。\n\n你可以继续描述下一个需求。`,
            timestamp: new Date(),
          });
        } else {
          addMessage({
            id: Date.now().toString() + '_fail',
            role: 'assistant',
            content: `❌ 提交失败: ${result.error}`,
            timestamp: new Date(),
            type: 'error',
          });
        }
      }
    } catch (err) {
      addMessage({
        id: Date.now().toString() + '_fail',
        role: 'assistant',
        content: `❌ 执行出错: ${err}`,
        timestamp: new Date(),
        type: 'error',
      });
    } finally {
      setPendingTask(null);
      setSubmitting(false);
      setStatusText('');
      setGuidedStep('logged-in-ready');
    }
  }

  function handleEditTask() {
    addMessage({
      id: Date.now().toString() + '_edit',
      role: 'user',
      content: '修改',
      timestamp: new Date(),
    });
    setPendingTask(null);
    setGuidedStep('logged-in-ready');
    addMessage({
      id: Date.now().toString() + '_retry',
      role: 'assistant',
      content: '好的，请重新描述你的需求',
      timestamp: new Date(),
    });
  }

  function handleRetry() {
    if (!lastPrompt) return;
    setInput(lastPrompt);
    setSelectedFiles([...lastFiles]);
    // Use setTimeout to ensure state updates before send
    setTimeout(() => {
      handleSend();
    }, 50);
  }

  // Listen for progress events
  useEffect(() => {
    const removeProgress = window.api.onProgress((data) => {
      if (data.event === 'result') {
        const item = data.data;
        if (item?.url) {
          useStore.getState().addResult(item);
          const icon = item.generateType === 'video' ? '🎬' : '🖼️';
          addMessage({
            id: Date.now().toString() + '_done',
            role: 'assistant',
            content: `${icon} 作品完成！\n${item.prompt?.slice(0, 60) || '生成成功'}`,
            timestamp: new Date(),
            type: 'result',
            data: item,
          });
        }
      } else if (data.event === 'download') {
        addMessage({
          id: Date.now().toString() + '_dl',
          role: 'system',
          content: `✅ 已下载: ${data.data?.filepath?.split('/').pop()}`,
          timestamp: new Date(),
          type: 'download',
        });
      } else if (data.event === 'queue-task-submitted') {
        addMessage({
          id: Date.now().toString() + '_qs',
          role: 'system',
          content: `📋 队列任务已提交: ${data.data?.prompt?.slice(0, 40)}...`,
          timestamp: new Date(),
        });
      } else if (data.event === 'queue-task-failed') {
        addMessage({
          id: Date.now().toString() + '_qf',
          role: 'system',
          content: `❌ 队列任务失败: ${data.data?.error}`,
          timestamp: new Date(),
          type: 'error',
        });
      } else if (data.event === 'batch-complete') {
        const { succeeded, failed, total } = data.data;
        addMessage({
          id: Date.now().toString() + '_bc',
          role: 'assistant',
          content: `📦 批量任务完成！\n✅ ${succeeded} 成功 / ❌ ${failed} 失败 / 共 ${total} 个任务`,
          timestamp: new Date(),
        });
      }
    });
    return () => removeProgress();
  }, []);

  async function handleSelectFiles() {
    const { files } = await window.api.selectFiles();
    if (files?.length) setSelectedFiles((prev) => [...prev, ...files]);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDownload(item: any) {
    const result = await window.api.downloadTask(item);
    if (result.success) {
      addMessage({
        id: Date.now().toString() + '_dl',
        role: 'system',
        content: `✅ 已下载: ${result.filepath?.split('/').pop()}`,
        timestamp: new Date(),
        type: 'download',
      });
    } else {
      addMessage({
        id: Date.now().toString() + '_dle',
        role: 'system',
        content: `❌ 下载失败: ${result.error}`,
        timestamp: new Date(),
        type: 'error',
      });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleDismissOnboarding() {
    localStorage.setItem('vidclaw_onboarded', 'true');
    setShowOnboarding(false);
  }

  function handleEmptyPromptClick(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  const canInput = (guidedStep === 'logged-in-ready' || guidedStep === 'task-done' || guidedStep === 'batch-collecting') && !isAiThinking;
  const showInputArea = ['logged-in-ready', 'task-drafting', 'task-confirming', 'task-executing', 'task-done', 'batch-collecting'].includes(guidedStep);

  return (
    <div className="flex flex-col h-full bg-surface-0 relative">
      {/* Onboarding Overlay (问题6) */}
      {showOnboarding && <OnboardingOverlay onDismiss={handleDismissOnboarding} isLoggedIn={!!useStore.getState().isLoggedIn} />}
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold text-text-primary">VidClaw</h1>
            <p className="text-xs text-text-muted flex items-center gap-1.5">
              {isSubmitting && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              )}
              {statusText || getStepDescription(guidedStep)}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && !isSubmitting ? (
          <EmptyState onPromptClick={handleEmptyPromptClick} />
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={msg.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 30, 150)}ms` }}>
                <MessageBubble
                  msg={msg}
                  onDownload={msg.type === 'result' && msg.data ? () => handleDownload(msg.data) : undefined}
                  onGuideClick={msg.type === 'guide-button' && guidedStep === 'welcome' ? handleReady : undefined}
                  onConfirm={msg.type === 'ai-rewrite' && msg.data && guidedStep === 'task-confirming' ? handleConfirmTask : undefined}
                  onEdit={msg.type === 'ai-rewrite' && msg.data && guidedStep === 'task-confirming' ? handleEditTask : undefined}
                  onRetry={msg.type === 'error' && lastPrompt ? handleRetry : undefined}
                  task={msg.type === 'ai-rewrite' ? msg.data : undefined}
                  onDurationChange={setSelectedDuration}
                  onRatioChange={setSelectedRatio}
                />
              </div>
            ))}

            {isSubmitting && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-surface-2 border border-border-subtle rounded-xl px-4 py-3 max-w-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-text-muted">{isAiThinking ? 'AI 正在思考...' : (statusText || '处理中...')}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Parameter Panel */}
      <ParameterPanel
        model={selectedModel}
        setModel={setSelectedModel}
        duration={selectedDuration}
        setDuration={setSelectedDuration}
        aspectRatio={selectedRatio}
        setAspectRatio={setSelectedRatio}
        visible={showParams && (canInput || guidedStep === 'task-confirming')}
      />

      {/* File preview */}
      {selectedFiles.length > 0 && showInputArea && (
        <div className="px-6 py-2 border-t border-border-subtle flex-shrink-0">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
            {selectedFiles.map((file, i) => {
              const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file);
              const isVideo = /\.(mp4|mov|avi|webm)$/i.test(file);
              return (
                <div key={i} className="relative group animate-fade-in">
                  <div className="w-[80px] h-[80px] rounded-lg overflow-hidden bg-surface-2 border border-border-subtle flex items-center justify-center">
                    {isImage ? (
                      <img
                        src={`file://${file}`}
                        alt={file.split('/').pop()}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : isVideo ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl">🎬</span>
                        <span className="text-[9px] text-text-muted">视频</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl">🎵</span>
                        <span className="text-[9px] text-text-muted">音频</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-error text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                  <p className="text-[9px] text-text-muted text-center mt-0.5 truncate max-w-[80px]">
                    {file.split('/').pop()}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Area */}
      {showInputArea && (
        <div className="px-6 py-4 border-t border-border-subtle flex-shrink-0">
          <div className="flex items-end gap-2.5">
            <button
              onClick={handleSelectFiles}
              disabled={!canInput}
              className="p-2.5 rounded-lg hover:bg-surface-2 text-text-muted hover:text-text-primary transition-all duration-150 flex-shrink-0 disabled:opacity-25 disabled:cursor-not-allowed"
              title="上传素材"
            >
              <Upload size={18} />
            </button>
            <button
              onClick={() => setShowParams(!showParams)}
              disabled={!canInput}
              className={`p-2.5 rounded-lg transition-all duration-150 flex-shrink-0 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-0.5 ${
                showParams ? 'bg-brand/15 text-brand' : 'hover:bg-surface-2 text-text-muted hover:text-text-primary'
              }`}
              title="参数设置"
            >
              <Settings2 size={18} />
              {showParams ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={canInput ? handleKeyDown : undefined}
                placeholder={canInput ? '描述你想生成的视频... 按 Enter 发送' : '请先完成当前步骤...'}
                rows={1}
                className="w-full bg-surface-1 border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus-brand transition-all duration-200"
                style={{ maxHeight: '120px' }}
                disabled={!canInput}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!input.trim() || !canInput}
              className="p-3 rounded-xl bg-brand-gradient hover:shadow-[var(--shadow-brand)] disabled:opacity-30 disabled:cursor-not-allowed text-white transition-all duration-150 flex-shrink-0 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-text-disabled mt-2 text-center">
            支持描述视频需求 · 上传参考图/视频 · ⚙️ 结构化模式（带素材时自动启用）
          </p>
        </div>
      )}
    </div>
  );
}

// ── Step Description ──
function getStepDescription(step: GuidedStep): string {
  switch (step) {
    case 'welcome': return '等待开始';
    case 'opening-browser': return '正在打开浏览器...';
    case 'waiting-login': return '等待扫码登录';
    case 'logged-in-ready': return '就绪，等待输入';
    case 'task-drafting': return 'AI 正在优化提示词...';
    case 'task-confirming': return '等待确认';
    case 'task-executing': return '正在执行...';
    case 'task-done': return '任务完成';
    default: return '';
  }
}

// ── Message Bubble ──
function MessageBubble({ msg, onDownload, onGuideClick, onConfirm, onEdit, onRetry, task, onDurationChange, onRatioChange }: {
  msg: Message;
  onDownload?: () => void;
  onGuideClick?: () => void;
  onConfirm?: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
  task?: any;
  onDurationChange?: (d: number) => void;
  onRatioChange?: (r: string) => void;
}) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  // System messages — minimal, centered
  if (isSystem) {
    return (
      <div className="flex justify-center">
        <p className="text-[11px] text-text-muted px-3 py-1">
          {msg.content}
        </p>
      </div>
    );
  }

  // Progress messages (问题5)
  if (msg.type === 'progress') {
    return <ProgressMessage msg={msg} />;
  }

  // Guide button message
  if (msg.type === 'guide-button' && onGuideClick) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-xl px-4 py-3 bg-surface-2 border border-border-subtle text-text-primary">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <div className="mt-3">
            <GuideButton label="准备好了" onClick={onGuideClick} />
          </div>
        </div>
      </div>
    );
  }

  // Mode select card
  if (msg.type === 'mode-select') {
    return (
      <div className="flex justify-start">
        <ModeSelectCard
          onSelect={(mode) => {
            useStore.getState().setTaskMode(mode);
            if (mode === 'batch') {
              useStore.getState().setGuidedStep('batch-collecting');
              // 添加追问消息
              useStore.getState().addMessage({
                id: Date.now().toString() + '_batch_question',
                role: 'assistant',
                content: '好的，批量任务模式。请告诉我：\n\n1. 这次批量测试的目标是什么？\n2. 你想生成多少个视频？\n3. 每个视频的测试重点分别是什么？',
                timestamp: new Date(),
              });
            } else {
              useStore.getState().setGuidedStep('logged-in-ready');
              useStore.getState().addMessage({
                id: Date.now().toString() + '_single_ready',
                role: 'assistant',
                content: '好的，单个任务模式。请描述你想生成的视频。',
                timestamp: new Date(),
              });
            }
          }}
        />
      </div>
    );
  }

  // Batch confirm card
  if (msg.type === 'batch-confirm' && (msg.data as any)?.tasks) {
    const data = msg.data as any;
    return (
      <div className="flex justify-start">
        <BatchConfirmCard
          tasks={data.tasks}
          batchName={data.batchName || '批量任务'}
          description={data.description || ''}
          onConfirm={onConfirm || (() => {})}
          onEdit={onEdit || (() => {})}
          onTaskEdit={(index) => {
            // TODO: 实现任务编辑
            console.log('Edit task', index);
          }}
        />
      </div>
    );
  }

  // AI rewrite confirm card
  if (msg.type === 'ai-rewrite' && task && onConfirm) {
    return (
      <div className="flex justify-start">
        <ConfirmCard
          task={task}
          onConfirm={onConfirm}
          onEdit={onEdit!}
          hasFiles={(task as any).hasFiles}
          selectedModel={(task as any).selectedModel}
          selectedDuration={(task as any).selectedDuration}
          selectedRatio={(task as any).selectedRatio}
          materials={(task as any).materials}
          onDurationChange={onDurationChange}
          onRatioChange={onRatioChange}
        />
      </div>
    );
  }

  // User vs Assistant messages
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 transition-all ${
          isUser
            ? 'bg-brand-gradient text-white shadow-[var(--shadow-brand)]'
            : msg.type === 'error'
            ? 'bg-error/10 text-error border border-error/20'
            : 'bg-surface-2 border border-border-subtle text-text-primary'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

        {/* Error retry button */}
        {msg.type === 'error' && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2.5 flex items-center gap-1.5 text-xs text-error hover:text-error/80 font-medium underline underline-offset-2 transition-colors"
          >
            <RefreshCw size={12} />
            重试
          </button>
        )}

        {/* Result download button */}
        {msg.type === 'result' && msg.data && (
          <button
            onClick={onDownload}
            className="mt-2.5 flex items-center gap-1.5 text-xs text-accent-light hover:text-accent transition-colors font-medium"
          >
            <Download size={13} />
            下载到本地
          </button>
        )}

        <p className={`text-[10px] mt-1.5 ${isUser ? 'text-white/40' : 'text-text-disabled'}`}>
          {msg.timestamp.toLocaleTimeString('zh-CN')}
        </p>
      </div>
    </div>
  );
}
