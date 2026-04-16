import { useState, useRef, useEffect } from 'react';
import { Send, Upload, X, Download, Loader2, CheckCircle, RefreshCw, Settings2, Layers, FileStack, Sparkles, Globe, Type, Video, ChevronDown, ChevronUp, AlertTriangle, ArrowUp, Play, XCircle, Plus, Zap, Clock, RectangleHorizontal, Paperclip, FolderOpen } from 'lucide-react';
import { useStore, type Message, type GuidedStep, type TaskMaterial, type TaskMode, type SendMode, type BatchTaskItem, type Skill } from '../store';
import { MaterialLibrary } from './MaterialLibrary';
import { localFileUrl, localFileUrlSync, isVideoFile, isAudioFile, isImageFile, getFileType } from '../utils/localFile';
import { SkillConfirmCard } from './confirm/SkillConfirmCard';
import { ConfirmCard } from './confirm/ConfirmCard';
import { BatchConfirmCard } from './confirm/BatchConfirmCard';
import { KlingConfirmCard } from './confirm/KlingConfirmCard';

// ── Mode Select Card (选择单个/批量) ──
function ModeSelectCard({ onSelect }: { onSelect: (mode: TaskMode) => void }) {
  return (
    <div className="bg-surface-2 border border-border rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
      {/* Top accent band */}
      <div className="h-px bg-brand flex-shrink-0" />
      <div className="p-4">
          <p className="text-xs text-accent font-medium mb-3 flex items-center gap-1.5">
            <span>🎯</span> 选择任务模式
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onSelect('single')}
              className="flex flex-col items-center gap-2 p-4 bg-surface-3 hover:bg-border rounded-md transition-all hover:-translate-y-0.5"
            >
              <FileStack size={24} className="text-brand" />
              <span className="text-sm font-medium">单个任务</span>
              <span className="text-xs text-text-muted">快速生成一个视频</span>
            </button>
            <button
              onClick={() => onSelect('batch')}
              className="flex flex-col items-center gap-2 p-4 bg-surface-3 hover:bg-border rounded-md transition-all hover:-translate-y-0.5"
            >
              <Layers size={24} className="text-accent" />
              <span className="text-sm font-medium">批量任务</span>
              <span className="text-xs text-text-muted">批量生成多个视频</span>
            </button>
          </div>
        </div>
    </div>
  );
}


// ── Empty State Card (问题2:空态引导) ──
function EmptyState({ onPromptClick }: { onPromptClick: (prompt: string) => void }) {
  const examples = [
    '一个女孩在海边跳舞,夕阳背景,浪漫风格',
    '帮我把这张照片变成 5 秒的短视频',
    '美食探店 vlog 片头,热气腾腾的火锅特写',
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 animate-fade-in">
      <div className="max-w-md w-full text-center">
        {/* Logo + Title */}
        <div className="w-14 h-14 rounded-md bg-brand flex items-center justify-center mx-auto mb-5 shadow-[var(--shadow-brand)]">
          <Sparkles size={24} className="text-white" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1.5">VidClaw - 说人话,出视频</h2>
        <p className="text-sm text-text-muted mb-8">描述你想要的视频,AI 帮你生成</p>

        {/* Example prompts */}
        <div className="space-y-2.5">
          {examples.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onPromptClick(prompt)}
              className="w-full text-left px-4 py-3 bg-surface-2 hover:bg-surface-3 border border-border-subtle hover:border-border rounded-md text-sm text-text-secondary hover:text-text-primary transition-all duration-150 group"
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
          💡 登录即梦后,直接输入描述即可生成视频
        </p>
      </div>
    </div>
  );
}

// ── Onboarding Overlay (重构3:完善新手引导) ──
function OnboardingOverlay({ onDismiss, isLoggedIn }: { onDismiss: () => void; isLoggedIn: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);

  // 三步引导内容
  const steps = [
    {
      title: '认识 VidClaw',
      content: (
        <div className="text-center">
          <div className="w-20 h-20 rounded-md bg-brand flex items-center justify-center mx-auto mb-5 shadow-[var(--shadow-brand)]">
            <Sparkles size={32} className="text-white" />
          </div>
          <h4 className="text-lg font-semibold text-text-primary mb-2">说人话，出视频</h4>
          <p className="text-sm text-text-muted mb-4">
            VidClaw 是你的 AI 视频创作助手，用自然语言描述想法，AI 自动生成高质量视频。
          </p>
          <div className="bg-surface-2 rounded-lg p-3 text-xs text-text-secondary">
            <p className="font-medium mb-2">核心能力</p>
            <ul className="space-y-1 text-left">
              <li>• 自动优化提示词，无需精通 AI 技巧</li>
              <li>• 支持上传图片/视频作为参考素材</li>
              <li>• 批量任务模式，一次测试多个场景</li>
              <li>• 自动下载并整理生成结果</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: '前提条件',
      content: (
        <div>
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4">
            <p className="text-sm font-medium text-warning flex items-center gap-2 mb-2">
              <AlertTriangle size={16} /> 需要即梦高级会员
            </p>
            <p className="text-xs text-text-muted mb-3">
              VidClaw 使用即梦 AI 的官方 CLI 工具，需要高级会员账号才能调用视频生成 API。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => window.api.authLogin?.()}
                className="flex-1 py-2 bg-brand hover:bg-brand/90 text-white text-sm rounded-md transition-all"
              >
                扫码登录
              </button>
              <a
                href="https://jimeng.jianying.com"
                target="_blank"
                className="flex-1 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary text-sm rounded-lg transition-all text-center"
              >
                前往即梦网页
              </a>
            </div>
          </div>
          
          <div className="bg-surface-2 rounded-lg p-3 text-xs text-text-secondary">
            <p className="font-medium mb-2">会员等级说明</p>
            <ul className="space-y-1">
              <li>• <span className="text-warning">高级会员</span>：解锁 Seedance 2.0 API</li>
              <li>• 普通会员：仅限网页端使用</li>
              <li>• 非会员：无法生成视频</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: '快速入门',
      content: (
        <div>
          <p className="text-sm text-text-muted mb-3">试试这些示例：</p>
          <div className="space-y-2">
            {[
              '一个女孩在海边跳舞，夕阳背景，浪漫风格',
              '帮我把这张照片变成 5 秒短视频',
              '美食探店 vlog 片头，热气腾腾的火锅特写',
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => {
                  onDismiss();
                  useStore.getState().setGuidedStep('logged-in-ready');
                }}
                className="w-full text-left px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs text-text-secondary hover:text-text-primary transition-all border border-border-subtle"
              >
                {i + 1}. {prompt}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-disabled mt-3 text-center">
            点击示例开始创作，或跳过自定义描述
          </p>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 animate-overlay-in">
      <div className="bg-surface-1 border border-border rounded-md p-6 max-w-md w-full mx-4 shadow-[var(--shadow-elevated)] animate-card-pop">
        {/* 进度指示器 */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? 'w-8 bg-brand' : 'w-2 bg-surface-3'
              }`}
            />
          ))}
        </div>

        {/* Step 标题 */}
        <h3 className="text-base font-semibold text-text-primary text-center mb-4">
          Step {currentStep + 1}: {currentStepData.title}
        </h3>

        {/* Step 内容 */}
        <div className="mb-6">
          {currentStepData.content}
        </div>

        {/* 按钮 */}
        <div className="flex items-center gap-3">
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 py-2 text-sm text-text-secondary bg-surface-2 hover:bg-surface-3 rounded-lg transition-all"
            >
              上一步
            </button>
          )}
          <button
            onClick={() => {
              if (currentStep < steps.length - 1) {
                setCurrentStep(currentStep + 1);
              } else {
                onDismiss();
                useStore.getState().setGuidedStep('welcome');
              }
            }}
            className="flex-1 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-md transition-all"
          >
            {currentStep < steps.length - 1 ? '下一步' : '开始使用'}
          </button>
        </div>
        <button
          onClick={onDismiss}
          className="w-full mt-2 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          跳过引导
        </button>
      </div>
    </div>
  );
}

// ── Progress Message (问题5:进度消息样式增强) ──
function ProgressMessage({ msg }: { msg: Message }) {
  const data = msg.data as any;
  const progressType = data?.progressType || 'generating';
  const percent = data?.percent;
  const error = data?.error;

  if (progressType === 'uploading') {
    return (
      <div className="flex justify-start animate-fade-in">
        <div className="bg-surface-2 border border-border-subtle rounded-md px-4 py-3 max-w-xs">
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
        <div className="bg-success/10 border border-success/20 rounded-md px-4 py-3 max-w-xs">
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
        <div className="bg-error/10 border border-error/20 rounded-md px-4 py-3 max-w-xs animate-shake">
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
      <div className="bg-surface-2 border border-border-subtle rounded-md px-4 py-3 max-w-xs">
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

// ── Pill Select Dropdown ──
function PillSelect({ label, icon, options, value, onChange, disabled }: {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string; desc?: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border-subtle hover:border-border bg-surface-1 hover:bg-surface-2 text-[11px] text-text-secondary hover:text-text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {icon && <span className="opacity-60">{icon}</span>}
        {label}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute bottom-full mb-1.5 left-0 bg-surface-3 border border-border rounded-xl shadow-xl z-20 overflow-hidden w-56">
          {options.some(o => o.desc) && (
            <div className="px-3.5 pt-2.5 pb-1.5 text-[10px] font-medium tracking-wider text-text-muted uppercase border-b border-border/50">
              选择模式
            </div>
          )}
          {options.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-start justify-between gap-2 ${
                i > 0 ? 'border-t border-border/30' : ''
              } ${
                opt.value === value
                  ? 'text-brand bg-brand/10'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{opt.label}</div>
                {opt.desc && (
                  <div className={`text-[11px] mt-0.5 leading-snug ${opt.value === value ? 'text-brand/70' : 'text-text-muted'}`}>
                    {opt.desc}
                  </div>
                )}
              </div>
              {opt.value === value && (
                <span className="text-brand mt-0.5 shrink-0 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Static info pill (no dropdown) ──
function PillTag({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-border-subtle bg-surface-1 text-[11px] text-text-secondary select-none">
      {icon && <span className="opacity-60">{icon}</span>}
      {label}
    </div>
  );
}

// ── Video Thumbnail with duration ──
function VideoThumb({ path, size = 48, onClick }: { path: string; size?: number; onClick?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Attach listeners BEFORE setting src to avoid race condition —
    // Chromium can fire loadedmetadata synchronously when src is set
    // if the resource is already cached.
    const onMeta = () => {
      if (cancelled) return;
      if (isFinite(video.duration)) setDuration(video.duration);
      // Seek into the clip; clamp in case duration is very short
      video.currentTime = Math.min(1, video.duration > 0 ? video.duration * 0.1 : 1);
    };

    const capture = () => {
      if (cancelled) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return;
      try {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        // 'data:,' means the canvas is blank / tainted
        if (dataUrl && dataUrl !== 'data:,') setThumb(dataUrl);
      } catch (e) {
        console.warn('[VideoThumb] drawImage failed:', e);
      }
    };

    const onSeeked = () => {
      if (cancelled) return;
      // rAF ensures the frame is actually painted before we read pixels
      requestAnimationFrame(capture);
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('seeked', onSeeked);

    // Set src imperatively AFTER listeners are registered
    localFileUrl(path).then(url => {
      if (cancelled) return;
      video.src = url;
      video.load();
    });

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('seeked', onSeeked);
      video.src = '';
    };
  }, [path]);

  const fmt = (s: number) => s >= 60 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : `${Math.floor(s)}s`;

  return (
    <div className="relative w-full h-full" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Keep video in-flow but invisible — off-screen elements may skip decode */}
      <video ref={videoRef} style={{ visibility: 'hidden', width: 0, height: 0, position: 'absolute' }} muted playsInline crossOrigin="anonymous" />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {thumb ? (
        <img src={thumb} className="w-full h-full object-cover" alt="" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surface-1">
          <Video size={size / 2.4} className="text-text-muted" />
        </div>
      )}
      {duration !== null && (
        <span className="absolute bottom-1 right-1 text-[9px] bg-black/75 text-white px-1 py-px rounded leading-none font-mono">
          {fmt(duration)}
        </span>
      )}
    </div>
  );
}

// ── Attachment Stack: card-fan, always visible on left of input ──
function AttachmentStack({ files, onView, onRemove, onAdd, canAdd }: {
  files: string[];
  onView: (path: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  canAdd: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const W = 64;
  const H = 80;
  const SHIFT = 10;   // horizontal offset per card in collapsed stack
  const GAP = 8;      // gap between cards when expanded
  const ROTS = [-5, 2.5, -3.5, 4.5, -2]; // rotation per position

  // ── Empty state: placeholder card ──
  if (files.length === 0) {
    return (
      <button
        onClick={canAdd ? onAdd : undefined}
        disabled={!canAdd}
        className="flex-shrink-0 flex flex-col items-center justify-center gap-1.5 rounded-xl transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          width: W, height: H,
          border: '2px dashed oklch(0.30 0.01 250)',
        }}
        onMouseOver={e => canAdd && ((e.currentTarget as HTMLButtonElement).style.borderColor = 'oklch(0.65 0.18 250)')}
        onMouseOut={e => ((e.currentTarget as HTMLButtonElement).style.borderColor = 'oklch(0.30 0.01 250)')}
      >
        <Plus size={18} className="text-text-muted group-hover:text-brand transition-colors" />
        <span className="text-[9px] text-text-muted group-hover:text-brand transition-colors leading-tight text-center">参考素材</span>
      </button>
    );
  }

  // Container width:
  //   collapsed — stack width (cards overlap)
  //   expanded  — full spread width so gaps between cards stay inside the hit-area,
  //               preventing the mouse-leaves-gap → collapse → flicker loop
  const collapsedW = W + Math.min(files.length - 1, 4) * SHIFT;
  const expandedW  = files.length * (W + GAP) - GAP;
  const containerW = hovered ? expandedW : collapsedW;
  // Front card index (highest z, drawn last) = files.length - 1
  const frontIdx = files.length - 1;
  // "+" position in collapsed: bottom-right of front card
  // front card left = frontIdx * SHIFT
  const plusCollapsedLeft = frontIdx * SHIFT + W - 12; // -12 to overlap card edge

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: containerW, height: H + 20, overflow: 'visible', transition: 'width 0.22s cubic-bezier(0.34,1.4,0.64,1)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {files.map((file, i) => {
        const isImg = isImageFile(file);
        const isVid = isVideoFile(file);
        const isAud = isAudioFile(file);
        const name = (file.split('/').pop() || '').replace(/\.[^.]+$/, '');
        const ext  = (file.split('.').pop() || 'AUD').toUpperCase();
        const isFront = i === frontIdx;

        const stackLeft = i * SHIFT;
        const expandLeft = i * (W + GAP);
        const rot = hovered ? 0 : ROTS[i % ROTS.length];
        // Collapsed: last card on top. Expanded: first card on top (left).
        const zIdx = hovered ? (files.length - i) : (i + 1);

        return (
          <div
            key={`${file}-${i}`}
            className="absolute group/card"
            style={{
              top: 12,
              left: hovered ? expandLeft : stackLeft,
              width: W, height: H,
              zIndex: zIdx,
              transform: `rotate(${rot}deg)`,
              transformOrigin: 'bottom center',
              transition: 'left 0.26s cubic-bezier(0.34,1.4,0.64,1), transform 0.26s cubic-bezier(0.34,1.4,0.64,1)',
            }}
          >
            {/* Filename tooltip (only in expanded, on individual hover) */}
            {hovered && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none z-50 opacity-0 group-hover/card:opacity-100 transition-opacity duration-150">
                <span className="block text-[10px] bg-[oklch(0.13_0.01_250)] text-white px-2 py-0.5 rounded-md shadow-lg whitespace-nowrap max-w-[90px] truncate border border-[oklch(0.26_0.01_250)]">
                  {name}
                </span>
              </div>
            )}

            {/* Card face */}
            <div
              className="w-full h-full rounded-xl overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.5)] cursor-pointer"
              onClick={() => hovered ? onView(file) : setHovered(true)}
            >
              {isImg && (
                <img src={localFileUrlSync(file)} className="w-full h-full object-cover" alt=""
                     onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              {isVid && <VideoThumb path={file} size={W} />}
              {isAud && (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 relative overflow-hidden"
                     style={{ background: 'linear-gradient(145deg, oklch(0.38 0.22 285), oklch(0.50 0.20 305))' }}>
                  {/* Waveform bars */}
                  <div className="flex items-end gap-[3px]" style={{ height: 24 }}>
                    {[38, 68, 50, 88, 58, 76, 40].map((h, j) => (
                      <div key={j} className="rounded-full" style={{
                        width: 3,
                        height: `${h}%`,
                        background: 'rgba(255,255,255,0.75)',
                      }} />
                    ))}
                  </div>
                  {/* Filename */}
                  <span className="text-[8px] text-white/90 w-full px-1.5 text-center truncate leading-tight">{name}</span>
                  {/* Format badge */}
                  <span className="text-[7px] font-mono font-semibold tracking-wider rounded-full px-1.5 py-px"
                        style={{ color: 'rgba(255,255,255,0.95)', background: 'rgba(255,255,255,0.18)' }}>
                    {ext}
                  </span>
                </div>
              )}
            </div>

            {/* × delete — visible when expanded + hovering this card */}
            {hovered && (
              <button
                onClick={e => { e.stopPropagation(); onRemove(i); }}
                className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-[oklch(0.13_0.01_250)] border border-[oklch(0.28_0.01_250)] text-white flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity shadow-md z-30"
              >
                <X size={9} />
              </button>
            )}

            {/* "+" always pinned to bottom-right of front/rightmost card */}
            {isFront && canAdd && (
              <button
                onClick={e => { e.stopPropagation(); onAdd(); }}
                className="absolute -bottom-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-40 shadow-[0_2px_8px_rgba(0,0,0,0.45)]"
                style={{ background: 'rgba(255,255,255,0.93)' }}
              >
                <Plus size={14} style={{ color: 'oklch(0.18 0.01 250)' }} />
              </button>
            )}
          </div>
        );
      })}
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
    { value: 'seedance2.0fast', label: 'Fast' },
    { value: 'seedance2.0', label: 'Standard' },
  ];
  const durations = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
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

// ── Guide Button ──
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
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-md transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0"
    >
      {icon}
      {label}
    </button>
  );
}

// ── Material Tag (可编辑素材标签) ──
function MaterialTag({ material, index, onEdit }: { material: { type: string; name: string; path: string; description?: string }; index: number; onEdit: (newDesc: string) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [desc, setDesc] = useState(material.description || material.name);

  const isImage = material.type === 'image';
  const isVideo = material.type === 'video';
  const isAudio = material.type === 'audio';
  const icon = isImage ? '📷' : isVideo ? '🎬' : '🎵';

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1">
        <span className="text-xs">{icon}</span>
        <input
          type="text"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="bg-transparent text-xs text-text-primary outline-none w-32"
          autoFocus
        />
        <button
          onClick={() => { onEdit(desc); setIsEditing(false); }}
          className="text-xs text-brand hover:underline"
        >
          ✓
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className="text-xs text-text-muted hover:underline"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1 bg-surface-2 hover:bg-surface-3 rounded-lg px-2 py-1 transition-colors"
    >
      <span className="text-xs">{icon}</span>
      <span className="text-xs text-text-primary">{desc}</span>
      <span className="text-xs text-text-muted">✏️</span>
    </button>
  );
}

// ── File Preview Chip (点击预览) ──
function FilePreviewChip({ material }: { material: { type: string; name: string; path: string } }) {
  const isImage = material.type === 'image';
  const isVideo = material.type === 'video';
  const isAudio = material.type === 'audio';

  const handlePreview = async () => {
    // Bug 3 修复：添加 fallback
    if (!material.path) {
      alert('文件路径无效');
      return;
    }
    const result = await window.api.openFile(material.path);
    if (!result.success) {
      // 尝试打开所在目录
      await window.api.openDownloadDir();
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

// ── Material thumbnails shown inside user message bubbles ──
type MaterialItem = { type: string; name: string; path: string };

function MaterialThumbs({ materials }: { materials: MaterialItem[] }) {
  const setPreviewUrl = useStore(s => s.setPreviewUrl);
  const [viewImg, setViewImg] = useState<string | null>(null);

  if (!materials.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-2">
        {materials.map((m, i) => {
          const isImg = m.type === 'image';
          const isVid = m.type === 'video';
          const isAud = m.type === 'audio';

          if (isImg) {
            return (
              <button
                key={i}
                onClick={() => setViewImg(m.path)}
                className="w-16 h-16 rounded-lg overflow-hidden border border-white/20 hover:border-white/50 transition-all flex-shrink-0 bg-black/20"
                title={m.name}
              >
                <img
                  src={localFileUrlSync(m.path)}
                  alt={m.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
              </button>
            );
          }

          if (isVid) {
            return (
              <button
                key={i}
                onClick={() => setPreviewUrl(localFileUrlSync(m.path))}
                className="w-16 h-16 rounded-lg overflow-hidden border border-white/20 hover:border-white/50 transition-all flex-shrink-0 relative"
                title={m.name}
              >
                <VideoThumb path={m.path} size={40} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                    <Play size={10} className="text-white ml-0.5" />
                  </div>
                </div>
              </button>
            );
          }

          if (isAud) {
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/20 bg-white/10 text-white/80 text-xs flex-shrink-0"
                title={m.name}
              >
                <span className="text-purple-300">♪</span>
                <span className="max-w-[80px] truncate">{m.name}</span>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Inline image lightbox */}
      {viewImg && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setViewImg(null)}
        >
          <img
            src={localFileUrlSync(viewImg)}
            alt="preview"
            className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            onClick={() => setViewImg(null)}
          >
            <X size={16} className="text-white" />
          </button>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
//  Main ChatPanel
// ═══════════════════════════════════════════
export function ChatPanel() {
  const {
    messages, addMessage, setMessages, isSubmitting, setSubmitting,
    statusText, setStatusText,
    guidedStep, setGuidedStep,
    taskMode, setTaskMode,
    sendMode, setSendMode,
    addTask, setBatchTasks,
  } = useStore();
  const setBatchInfo = useStore(s => s.setBatchInfo);
  const addHistory = useStore(s => s.addHistory);
  const updateUsage = useStore(s => s.updateUsage);
  const { addSkill, updateSkill, activeSkill, setActiveSkill, credits, deductCredits, addCredits, pendingSkillConfirm, setPendingSkillConfirm } = useStore();

  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [pendingTask, setPendingTask] = useState<any>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [lastPrompt, setLastPrompt] = useState('');
  const [lastFiles, setLastFiles] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Structured task params — 持久化到 localStorage，重启后恢复用户上次选择
  const [selectedModel, setSelectedModelRaw] = useState<string>(() => {
    try { return localStorage.getItem('vidclaw_toolbar_model') || 'seedance2.0fast'; } catch { return 'seedance2.0fast'; }
  });
  const [selectedDuration, setSelectedDurationRaw] = useState<number>(() => {
    try { return Number(localStorage.getItem('vidclaw_toolbar_duration')) || 5; } catch { return 5; }
  });
  const [selectedRatio, setSelectedRatioRaw] = useState<string>(() => {
    try { return localStorage.getItem('vidclaw_toolbar_ratio') || '9:16'; } catch { return '9:16'; }
  });

  const setSelectedModel = (v: string) => {
    try { localStorage.setItem('vidclaw_toolbar_model', v); } catch {}
    setSelectedModelRaw(v);
  };
  const setSelectedDuration = (v: number) => {
    try { localStorage.setItem('vidclaw_toolbar_duration', String(v)); } catch {}
    setSelectedDurationRaw(v);
  };
  const setSelectedRatio = (v: string) => {
    try { localStorage.setItem('vidclaw_toolbar_ratio', v); } catch {}
    setSelectedRatioRaw(v);
  };

  // ── Auto-duration: Seedance + reference videos ───────────────────────────
  // When reference videos are added/removed while using a SeedDance model,
  // auto-set selectedDuration to the sum of all video durations (clamped 4–15s).
  // Only fires when the video subset changes (not on image/audio add/remove).
  const prevVidFilesRef = useRef<string[]>([]);
  useEffect(() => {
    const VID_EXTS = /\.(mp4|mov)$/i;
    const vidFiles = selectedFiles.filter(f => VID_EXTS.test(f));

    // Bail out if video list hasn't changed (avoids re-firing on image/audio edits)
    const prev = prevVidFilesRef.current;
    const vidChanged = vidFiles.length !== prev.length || vidFiles.some((f, i) => f !== prev[i]);
    prevVidFilesRef.current = vidFiles;

    if (!vidChanged || !vidFiles.length || selectedModel === 'kling-o1') return;

    let cancelled = false;
    (async () => {
      let total = 0;
      for (const f of vidFiles) {
        const dur = await new Promise<number>((resolve) => {
          const el = document.createElement('video');
          el.preload = 'metadata';
          el.onloadedmetadata = () => resolve(isFinite(el.duration) ? el.duration : 0);
          el.onerror = () => resolve(0);
          el.src = localFileUrlSync(f);
        });
        total += dur;
      }
      if (cancelled) return;
      setSelectedDuration(Math.min(15, Math.max(4, Math.round(total))));
    })();

    return () => { cancelled = true; };
  }, [selectedFiles, selectedModel]);
  const [showParams, setShowParams] = useState(false);
  const [useStructuredFlow] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('vidclaw_onboarded'));
  const [showMaterialLib, setShowMaterialLib] = useState(false);
  const [viewFile, setViewFile] = useState<string | null>(null);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [lastInput, setLastInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── 技能相关状态 ──
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [queueToast, setQueueToast] = useState('');
  const [saveSkillContext, setSaveSkillContext] = useState<{
    type: 'single' | 'batch' | 'kling';
    prompt?: string;
    model?: string;
    duration?: number;
    aspectRatio?: string;
    materialSlots?: Array<{ type: 'image' | 'video' | 'audio'; path?: string }>;
  } | null>(null);
  const [saveSkillName, setSaveSkillName] = useState('');

  // ── 素材描述编辑处理 ──
  function handleEditMaterial(index: number, newDesc: string) {
    if (!pendingTask || !pendingTask.materials) return;

    const images: any[] = pendingTask.materials.images || [];
    const videos: any[] = pendingTask.materials.videos || [];
    const audios: any[] = pendingTask.materials.audios || [];
    const allMaterials = [...images, ...videos, ...audios];
    if (index >= allMaterials.length) return;

    // Build updated arrays immutably
    let imgIdx = 0, vidIdx = 0, audIdx = 0;
    const newImages = [...images];
    const newVideos = [...videos];
    const newAudios = [...audios];

    allMaterials.forEach((m, i) => {
      if (m.type === 'image') {
        if (i === index) newImages[imgIdx] = { ...m, description: newDesc };
        imgIdx++;
      } else if (m.type === 'video') {
        if (i === index) newVideos[vidIdx] = { ...m, description: newDesc };
        vidIdx++;
      } else if (m.type === 'audio') {
        if (i === index) newAudios[audIdx] = { ...m, description: newDesc };
        audIdx++;
      }
    });

    setPendingTask({ ...pendingTask, materials: { images: newImages, videos: newVideos, audios: newAudios } });
  }

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
        content: '你好，我是 VidClaw —— 用自然语言描述你想要的视频，AI 帮你生成。\n\n首先需要登录即梦账号（抖音授权）。准备好了吗？',
        timestamp: new Date(),
        type: 'guide-button',
      });
    }
  }, []);

  // Auto-insert skill-confirm card when SkillsPanel triggers a skill
  useEffect(() => {
    if (!pendingSkillConfirm) return;
    const skill = pendingSkillConfirm;
    setPendingSkillConfirm(null);
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: `[应用技能] ${skill.name}`,
      timestamp: new Date(),
    });
    setGuidedStep('task-confirming');
    addMessage({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      type: 'skill-confirm',
      data: { skill, initialFiles: [] },
    });
  }, [pendingSkillConfirm]);

  // ── Guide flow handlers ──
  async function handleReady() {
    addMessage({
      id: Date.now().toString() + '_ready',
      role: 'user',
      content: '准备好了',
      timestamp: new Date(),
    });

    setGuidedStep('checking-login');
    addMessage({
      id: Date.now().toString() + '_checking',
      role: 'assistant',
      content: '正在检查登录状态...',
      timestamp: new Date(),
    });

    try {
      // Step 1: 检查已有登录态
      const creditsResult = await window.api.checkCredits();

      if (creditsResult.success && creditsResult.isLoggedIn) {
        // 已登录,直接进入就绪状态
        addMessage({
          id: Date.now().toString() + '_already_login',
          role: 'assistant',
          content: `✅ 已登录账号(剩余积分: ${creditsResult.credits || 0}),正在初始化...`,
          timestamp: new Date(),
        });
        useStore.getState().setIsLoggedIn(true);
        setGuidedStep('logged-in-ready');
        addMessage({
          id: Date.now().toString() + '_ready',
          role: 'assistant',
          content: '✅ 就绪！左下角可以切换三种模式：\n✨ 智能生成 — 描述想法，AI 帮你优化成提示词\n📋 批量规划 — 描述目标，AI 自动拆解成多个任务\n⚡ 专业模式 — 自己写好提示词，直接发送\n\n默认是智能生成，描述你想生成的视频效果就行。',
          timestamp: new Date(),
        });
        return;
      }

      // Step 2: 未登录,进行 CLI 登录
      setGuidedStep('waiting-login');
      addMessage({
        id: Date.now().toString() + '_need_login',
        role: 'assistant',
        content: '未检测到登录态,正在启动登录流程...',
        timestamp: new Date(),
      });

      // 启动登录
      const loginResult = await window.api.authLogin();

      // 登录成功 —— onProgress('login-success') 已经处理了 UI，此处无需重复
      if (loginResult.success) {
        // onProgress 已设置 isLoggedIn / guidedStep / 成功消息，不再重复
      } else {
        // login-failed 进度事件已统一处理所有失败（含超时），此处只重置状态
        setGuidedStep('welcome');
      }
    } catch (err) {
      addMessage({
        id: Date.now().toString() + '_err',
        role: 'assistant',
        content: `❌ 检查登录出错: ${err}`,
        timestamp: new Date(),
        type: 'error',
      });
      setGuidedStep('welcome');
    }
  }

  async function handleLoginRetry() {
    // 清除所有登录相关的旧消息
    setMessages((prev) => prev.filter(m =>
      m.type !== 'login-error' && m.type !== 'qr-code' && m.type !== 'login-loading'
    ));

    setGuidedStep('waiting-login');
    addMessage({
      id: Date.now().toString() + '_retry_login',
      role: 'assistant',
      content: '正在重新启动登录流程...',
      timestamp: new Date(),
    });

    const loginResult = await window.api.authLogin();

    if (loginResult.success) {
      // onProgress('login-success') 已处理 UI，此处无需重复
    } else {
      // login-failed 进度事件已统一处理所有失败（含超时），此处只重置状态
      setGuidedStep('welcome');
    }
  }


  async function handleSend() {
    if (isSubmitting) return;
    if (guidedStep === 'task-confirming') return;

    // Kling O1: 必须上传图片，校验失败直接提示
    if (selectedModel === 'kling-o1') {
      const imageFiles = selectedFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      if (imageFiles.length === 0) {
        addMessage({
          id: Date.now().toString() + '_kling_noimgs',
          role: 'assistant',
          content: '⚠️ 可灵 O1 是图生视频模型，请先上传至少一张图片（支持 jpg/png/webp）',
          timestamp: new Date(),
          type: 'error',
        });
        return;
      }
    }

    if (!input.trim() && selectedModel !== 'kling-o1') return;

    if (sendMode === 'ai-batch') {
      await handleBatchSend();
      return;
    }
    if (sendMode === 'direct') {
      await handleDirectSend();
      return;
    }

    // ===== AI 单个任务模式 =====
    // 构建素材信息(用于 Seedance 模式改写)
    const materials = {
      images: [] as Array<{ type: string; name: string; path: string }>,
      videos: [] as Array<{ type: string; name: string; path: string }>,
      audios: [] as Array<{ type: string; name: string; path: string }>,
    };

    // 按类型分类并命名文件
    let imageIdx = 0, videoIdx = 0, audioIdx = 0;
    selectedFiles.forEach(f => {
      const filename = f.split('/').pop() || f;
      if (isVideoFile(f)) {
        videoIdx++;
        materials.videos.push({ type: 'video', name: `视频${videoIdx}`, filename, path: f });
      } else if (isAudioFile(f)) {
        audioIdx++;
        materials.audios.push({ type: 'audio', name: `音频${audioIdx}`, filename, path: f });
      } else {
        imageIdx++;
        materials.images.push({ type: 'image', name: `图片${imageIdx}`, filename, path: f });
      }
    });

    const hasFiles = selectedFiles.length > 0;
    const flatMaterials = hasFiles
      ? [...materials.images, ...materials.videos, ...materials.audios]
      : [];

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      ...(flatMaterials.length > 0 && { data: { materials: flatMaterials } }),
    };

    addMessage(userMsg);
    setLastPrompt(input.trim());
    setLastInput(input.trim());
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
          content: `❌ ${result.error || 'AI 改写失败,请重试'}`,
          timestamp: new Date(),
          type: 'error',
        });
        setGuidedStep('logged-in-ready');
      } else if ((result as any).needsClarification) {
        // 追问场景：多素材 + 模糊需求
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '🤔 你上传了多个素材，我需要确认一下：',
          timestamp: new Date(),
          type: 'clarification',
          data: {
            questions: (result as any).questions,
            materials: (result as any).materials,
          },
        });
        // 保存推断结果，待用户回答后使用
        setPendingTask({
          ...result.task,
          materials: (result as any).materials,
          userInput: userMsg.content,
        });
      } else {
        // Bug 2 修复：pendingTask 需保存 materials
        setPendingTask({
          ...result.task,
          materials: materials,
          selectedModel,
          selectedDuration,
          selectedRatio,
          hasFiles,
        });
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

  // ===== 批量任务发送 =====
  async function handleBatchSend() {
    // 构建素材信息（与 ai-single 模式一致，所有子任务共享参考素材）
    const batchMaterials = {
      images: [] as Array<{ type: string; name: string; path: string }>,
      videos: [] as Array<{ type: string; name: string; path: string }>,
      audios: [] as Array<{ type: string; name: string; path: string }>,
    };
    let imgIdx = 0, vidIdx = 0, audIdx = 0;
    selectedFiles.forEach(f => {
      const filename = f.split('/').pop() || f;
      if (isVideoFile(f)) {
        vidIdx++;
        batchMaterials.videos.push({ type: 'video', name: `视频${vidIdx}`, filename, path: f });
      } else if (isAudioFile(f)) {
        audIdx++;
        batchMaterials.audios.push({ type: 'audio', name: `音频${audIdx}`, filename, path: f });
      } else {
        imgIdx++;
        batchMaterials.images.push({ type: 'image', name: `图片${imgIdx}`, filename, path: f });
      }
    });

    const hasFiles = selectedFiles.length > 0;
    const flatBatchMaterials = hasFiles
      ? [...batchMaterials.images, ...batchMaterials.videos, ...batchMaterials.audios]
      : [];

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      ...(flatBatchMaterials.length > 0 && { data: { materials: flatBatchMaterials } }),
    };
    addMessage(userMsg);
    setLastInput(input.trim());
    setInput('');
    setSelectedFiles([]);
    setSubmitting(true);
    setTaskMode('batch');
    setGuidedStep('task-drafting');
    setStatusText('🧠 AI 正在规划批量任务...');

    const batchDefaults = { model: selectedModel, duration: selectedDuration, aspectRatio: selectedRatio };

    try {
      const result = await window.api.prepareBatchTasks(userMsg.content, batchMaterials, batchDefaults);
      if (result.questions && result.questions.length > 0) {
        const questionList = result.questions.map((q: any, i: number) =>
          `${i + 1}. ${typeof q === 'string' ? q : q.text || JSON.stringify(q)}`
        ).join('\n');
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `🤔 我已经调用了 AI 做批量规划，但它认为当前信息还不够，先需要你补充这几点：\n\n${questionList}`,
          timestamp: new Date(),
        });
        setGuidedStep('logged-in-ready');
      } else if (!result.success || !result.tasks || result.tasks.length === 0) {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ ${result.error || '批量任务生成失败，请重试'}`,
          timestamp: new Date(),
          type: 'error',
        });
        setGuidedStep('logged-in-ready');
        setTaskMode('single');
      } else {
        // Populate batchTasks store so the confirm card can read/edit live state
        const forcedModel = selectedModel === 'kling-o1' ? 'kling-o1' : undefined;
        const mappedTasks: BatchTaskItem[] = result.tasks.map((t: any, i: number) => ({
          id: `task_${Date.now()}_${i}`,
          index: i,
          prompt: t.prompt || '',
          reason: t.reason || '',
          materials: flatBatchMaterials.map(m => ({ path: (m as any).path, type: m.type as 'image' | 'video' | 'audio' })),
          expectedEffect: t.expectedEffect || '',
          duration: t.duration || selectedDuration,
          aspectRatio: t.aspectRatio || selectedRatio,
          model: forcedModel || t.model || selectedModel,
          status: 'pending' as const,
        }));
        setBatchTasks(mappedTasks);

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
            materials: flatBatchMaterials,
            selectedModel,
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
      setTaskMode('single');
    } finally {
      setSubmitting(false);
      setStatusText('');
    }
  }

  // ===== 直接发送（跳过 AI 改写）=====
  async function handleDirectSend() {
    const prompt = input.trim();

    // 专业模式 + 可灵：弹出确认卡（需积分确认），不直接提交
    if (selectedModel === 'kling-o1') {
      const imageFiles = selectedFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
      const cost = selectedDuration * 10;
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: prompt || '（未输入提示词）',
        timestamp: new Date(),
        data: { materials: imageFiles.map((f, i) => ({ type: 'image', name: `图片${i + 1}`, path: f })) },
      };
      addMessage(userMsg);
      addMessage({
        id: Date.now().toString() + '_kling_confirm',
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        type: 'kling-confirm',
        data: { prompt, imagePaths: imageFiles, duration: selectedDuration, aspectRatio: selectedRatio, cost },
      });
      setSelectedFiles([]);
      setInput('');
      return;
    }

    const filesToSubmit = [...selectedFiles];
    const hasFiles = filesToSubmit.length > 0 && useStructuredFlow;

    const directMaterials = hasFiles ? filesToSubmit.map(f => {
      const filename = f.split('/').pop() || f;
      return { type: getFileType(f), name: filename, path: f };
    }) : [];
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
      ...(directMaterials.length > 0 && { data: { materials: directMaterials } }),
    };
    addMessage(userMsg);
    setInput('');
    setSelectedFiles([]);
    setSubmitting(true);
    setGuidedStep('task-executing');
    setStatusText('⏳ 正在提交任务...');

    try {
      let result;
      let taskSubmitId: string | undefined;
      if (hasFiles) {
        const materials: TaskMaterial[] = filesToSubmit.map(f => ({
          path: f,
          type: getFileType(f),
        }));
        setStatusText('📤 正在上传素材...');
        const r = await window.api.runStructuredTask({
          prompt,
          materials,
          model: selectedModel,
          duration: selectedDuration,
          aspectRatio: selectedRatio,
        });
        result = r;
        taskSubmitId = (r as any).submitId;
      } else {
        const r = await window.api.executeTask({
          prompt,
          model: selectedModel,
          duration: selectedDuration,
          aspectRatio: selectedRatio,
        });
        result = r;
        taskSubmitId = (r as any).submitId;
      }

      if (result.success) {
        addTask({
          id: 'task_' + Date.now(),
          submitId: taskSubmitId,
          prompt,
          type: 'video',
          status: 'generating',
          model: selectedModel,
          duration: selectedDuration,
          materials: [],
          createdAt: Date.now(),
          startTime: Date.now(),
          retryCount: 0,
        });
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ 任务已提交！即梦正在生成中，结果会自动展示。`,
          timestamp: new Date(),
        });
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ 提交失败: ${result.error}`,
          timestamp: new Date(),
          type: 'error',
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
    } finally {
      setSubmitting(false);
      setGuidedStep('logged-in-ready');
      setStatusText('');
    }
  }

  async function handleConfirmTask(editedPrompt?: string) {
    if (!pendingTask) return;

    // Use inline-edited prompt if provided, otherwise fall back to AI rewrite
    const effectiveTask = (editedPrompt && editedPrompt.trim())
      ? { ...pendingTask, prompt: editedPrompt.trim() }
      : pendingTask;

    // Bug 1 修复：先保存副本，再清空 state
    const filesToSubmit = [...selectedFiles];
    const hasFiles = filesToSubmit.length > 0 && useStructuredFlow;

    addMessage({
      id: Date.now().toString() + '_confirm',
      role: 'user',
      content: '确认提交',
      timestamp: new Date(),
      type: 'submitted-summary',
      data: {
        kind: selectedModel === 'kling-o1' ? 'kling' : 'single',
        prompt: effectiveTask.prompt,
        materials: filesToSubmit.map(f => ({ path: f, type: getFileType(f) as 'image' | 'video' | 'audio' })),
        model: selectedModel,
        duration: selectedDuration,
        aspectRatio: selectedRatio,
      },
    });

    setSubmitting(true);
    setGuidedStep('task-executing');
    setStatusText('⏳ 正在提交任务...');
    setSelectedFiles([]);

    try {

      // 可灵 O1 执行路径
      if (selectedModel === 'kling-o1') {
        const imagePaths = filesToSubmit.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (imagePaths.length === 0) {
          addMessage({
            id: Date.now().toString() + '_kling_noimgs',
            role: 'assistant',
            content: '❌ 可灵 O1 需要上传参考图片',
            timestamp: new Date(),
            type: 'error',
          });
          setPendingTask(null);
          setSubmitting(false);
          setStatusText('');
          setGuidedStep('logged-in-ready');
          return;
        }
        const cost = selectedDuration * 10;
        if (credits.balance < cost) {
          addMessage({
            id: Date.now().toString() + '_credits_low',
            role: 'assistant',
            content: `❌ 积分不足。需要 ${cost} 积分，当前余额 ${credits.balance}`,
            timestamp: new Date(),
            type: 'error',
          });
          setPendingTask(null);
          setSubmitting(false);
          setStatusText('');
          setGuidedStep('logged-in-ready');
          return;
        }
        deductCredits(cost, `可灵 O1 · ${selectedDuration}s 视频`);
        const submitId = 'kling_' + Date.now();
        addTask({
          id: 'task_' + Date.now(),
          submitId,
          prompt: effectiveTask.prompt,
          type: 'video',
          status: 'generating',
          progress: 0,
          statusMessage: '准备中...',
          model: 'kling-o1',
          duration: selectedDuration,
          materials: imagePaths.map(p => ({ path: p, type: 'image' as const })),
          createdAt: Date.now(),
          retryCount: 0,
        });
        void window.api.klingGenerate({ imagePaths, prompt: effectiveTask.prompt, duration: selectedDuration, aspectRatio: selectedRatio, submitId });
        setInput('');
        showQueueToast('✅ 已加入队列，前往排队区查看进度');
        setPendingTask(null);
        setSubmitting(false);
        setStatusText('');
        setGuidedStep('logged-in-ready');
        return;
      }

      if (hasFiles) {
        const materials: TaskMaterial[] = filesToSubmit.map(f => ({
          path: f,
          type: getFileType(f),
        }));

        setStatusText('📤 正在上传素材...');
        const result = await window.api.runStructuredTask({
          prompt: effectiveTask.prompt,
          materials,
          model: selectedModel,
          duration: selectedDuration,
          aspectRatio: selectedRatio,
        });

        if (result.success) {
          addTask({
            id: 'task_' + Date.now(),
            submitId: (result as any).submitId,
            prompt: effectiveTask.prompt,
            type: 'video',
            status: 'generating',
            model: selectedModel,
            duration: selectedDuration,
            materials: [],
            createdAt: Date.now(),
            startTime: Date.now(),
            retryCount: 0,
          });
          addMessage({
            id: Date.now().toString() + '_submitted',
            role: 'assistant',
            content: `✅ 结构化任务已提交!\n模型: ${selectedModel} | 时长: ${selectedDuration}s | 比例: ${selectedRatio}\n素材: ${filesToSubmit.length} 个文件\n结果会自动展示。`,
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
        const result = await window.api.executeTask({
          prompt: effectiveTask.prompt,
          model: selectedModel,
          duration: selectedDuration,
          aspectRatio: selectedRatio,
        });

        if (result.success) {
          addTask({
            id: 'task_' + Date.now(),
            submitId: (result as any).submitId,
            prompt: effectiveTask.prompt,
            type: 'video',
            status: 'generating',
            model: selectedModel,
            duration: selectedDuration,
            materials: [],
            createdAt: Date.now(),
            startTime: Date.now(),
            retryCount: 0,
          });
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

  function handleEditTask(rewriteMsgId?: string) {
    let restoredInput = '';
    let restoredFiles: string[] = [];
    setMessages(prev => {
      if (!rewriteMsgId) return prev;
      const idx = prev.findIndex(m => m.id === rewriteMsgId);
      if (idx === -1) return prev;
      const sourceMsg = idx > 0 && prev[idx - 1].role === 'user' ? prev[idx - 1] : undefined;
      restoredInput = sourceMsg?.content || lastInput;
      restoredFiles = Array.isArray(sourceMsg?.data?.materials)
        ? sourceMsg.data.materials
            .map((m: any) => m?.path)
            .filter((path: unknown): path is string => typeof path === 'string' && path.length > 0)
        : [...lastFiles];
      const start = sourceMsg ? idx - 1 : idx;
      return prev.filter((_, i) => i < start || i > idx);
    });
    setPendingTask(null);
    setGuidedStep('logged-in-ready');
    setInput(restoredInput);
    setSelectedFiles(restoredFiles);
  }

  function handleEditBatchConfirm(confirmMsgId?: string) {
    let restoredInput = '';
    let restoredFiles: string[] = [];
    setMessages(prev => {
      if (!confirmMsgId) return prev;
      const idx = prev.findIndex(m => m.id === confirmMsgId);
      if (idx === -1) return prev;
      const sourceMsg = idx > 0 && prev[idx - 1].role === 'user' ? prev[idx - 1] : undefined;
      restoredInput = sourceMsg?.content || lastInput;
      restoredFiles = Array.isArray(sourceMsg?.data?.materials)
        ? sourceMsg.data.materials
            .map((m: any) => m?.path)
            .filter((path: unknown): path is string => typeof path === 'string' && path.length > 0)
        : [...lastFiles];
      const start = sourceMsg ? idx - 1 : idx;
      return prev.filter((_, i) => i < start || i > idx);
    });
    setTaskMode('batch');
    setGuidedStep('logged-in-ready');
    setInput(restoredInput || lastInput);
    setSelectedFiles(restoredFiles);
  }

  async function handleConfirmBatch(batchData: any) {
    // Read from live store (user may have edited/added/deleted tasks)
    const liveTasks = useStore.getState().batchTasks;
    if (!liveTasks.length) return;

    addMessage({
      id: Date.now().toString() + '_batch_confirm',
      role: 'user',
      content: `确认批量提交 (${liveTasks.length} 个任务)`,
      timestamp: new Date(),
      type: 'submitted-summary',
      data: {
        kind: 'batch',
        prompt: liveTasks[0]?.prompt ?? '',
        prompts: liveTasks.map(t => t.prompt),
        materials: (liveTasks[0]?.materials ?? []).map(m => ({ path: m.path, type: m.type as 'image' | 'video' | 'audio' })),
        model: liveTasks[0]?.model,
        duration: liveTasks[0]?.duration,
        aspectRatio: liveTasks[0]?.aspectRatio,
        taskCount: liveTasks.length,
      },
    });

    setSubmitting(true);
    setGuidedStep('task-executing');
    setStatusText('⏳ 正在创建批量任务...');

    try {
      // 可灵 O1 批量执行路径：逐条调用 klingGenerate
      if (liveTasks[0]?.model === 'kling-o1') {
        const imagePaths = (liveTasks[0]?.materials ?? [])
          .filter(m => m.type === 'image')
          .map(m => m.path);
        if (imagePaths.length === 0) {
          addMessage({
            id: Date.now().toString() + '_kling_noimgs',
            role: 'assistant',
            content: '❌ 可灵 O1 批量任务需要上传参考图片',
            timestamp: new Date(),
            type: 'error',
          });
          setSubmitting(false);
          setStatusText('');
          setGuidedStep('logged-in-ready');
          return;
        }
        const totalCost = liveTasks.reduce((sum, t) => sum + (t.duration * 10), 0);
        if (credits.balance < totalCost) {
          addMessage({
            id: Date.now().toString() + '_credits_low',
            role: 'assistant',
            content: `❌ 积分不足。${liveTasks.length} 条任务共需 ${totalCost} 积分，当前余额 ${credits.balance}`,
            timestamp: new Date(),
            type: 'error',
          });
          setSubmitting(false);
          setStatusText('');
          setGuidedStep('logged-in-ready');
          return;
        }
        deductCredits(totalCost, `可灵 O1 · ${liveTasks.length} 个批量任务`);
        const batchId = 'kling_batch_' + Date.now();
        const klingBatchItems = liveTasks.map((t, i) => ({
          id: 'task_' + Date.now() + '_' + i,
          index: i,
          prompt: t.prompt,
          reason: t.reason ?? '',
          materials: imagePaths.map(p => ({ path: p, type: 'image' as const })),
          expectedEffect: t.expectedEffect ?? '',
          duration: t.duration,
          aspectRatio: t.aspectRatio,
          model: 'kling-o1',
          status: 'generating' as const,
          submitId: batchId + '_' + i,
        }));
        setBatchTasks(klingBatchItems);
        setBatchInfo({
          id: batchId,
          name: '可灵 O1 批量任务',
          description: `共 ${liveTasks.length} 个任务`,
          totalTasks: liveTasks.length,
          completedTasks: 0,
          status: 'running' as const,
          createdAt: new Date().toISOString(),
          downloadDir: '',
        });
        klingBatchItems.forEach((bt) => {
          void window.api.klingGenerate({ imagePaths, prompt: bt.prompt, duration: bt.duration, aspectRatio: bt.aspectRatio, submitId: bt.submitId });
        });
        addMessage({
          id: Date.now().toString() + '_kling_batch_started',
          role: 'assistant',
          content: `🚀 可灵批量任务已启动！共 ${liveTasks.length} 个任务，消耗 ${totalCost} 积分。可在作品页查看进度。`,
          timestamp: new Date(),
        });
        setSubmitting(false);
        setStatusText('');
        setGuidedStep('logged-in-ready');
        return;
      }

      const batch = {
        id: 'batch_' + Date.now(),
        name: batchData.batchName || '批量任务',
        description: batchData.description || '',
        totalTasks: liveTasks.length,
        completedTasks: 0,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        downloadDir: '',
      };

      const tasks = liveTasks.map((t, i) => ({
        id: t.id,
        index: i,
        prompt: t.prompt,
        reason: t.reason,
        materials: t.materials,
        expectedEffect: t.expectedEffect,
        duration: t.duration,
        aspectRatio: t.aspectRatio,
        model: t.model,
        status: 'pending' as const,
      }));

      const createResult = await window.api.createBatch(batch, tasks);
      if (!createResult.success) {
        throw new Error(createResult.error || '创建批量任务失败');
      }

      setStatusText('🚀 批量任务已创建,正在启动...');
      const startResult = await window.api.startBatch();
      if (!startResult.success) {
        throw new Error(startResult.error || '启动批量任务失败');
      }

      addMessage({
        id: Date.now().toString() + '_batch_started',
        role: 'assistant',
        content: `🚀 批量任务已启动！共 ${liveTasks.length} 个任务。\n\n即梦每次最多同时生成 **2 个视频**，我们会自动排队——前 2 个提交后，等它们完成再依次提交后面的。可在作品页查看进度。`,
        timestamp: new Date(),
      });
    } catch (err) {
      addMessage({
        id: Date.now().toString() + '_batch_fail',
        role: 'assistant',
        content: `❌ 批量任务启动失败：${err}\n\n如有旧任务卡住，重新提交即可自动替换。`,
        timestamp: new Date(),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
      setStatusText('');
      setGuidedStep('logged-in-ready');
    }
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

  // ── 技能应用 ──
  function handleApplySkill(skill: Skill) {
    setShowSkillPicker(false);
    const files = [...selectedFiles];
    const flatMaterials = files.map((f, idx) => {
      const type = getFileType(f);
      return { type, name: `${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}${idx + 1}`, path: f };
    });
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: `[应用技能] ${skill.name}`,
      timestamp: new Date(),
      ...(flatMaterials.length > 0 && { data: { materials: flatMaterials } }),
    });
    setGuidedStep('task-confirming');
    addMessage({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      type: 'skill-confirm',
      data: { skill, initialFiles: files },
    });
    setSelectedFiles([]);
  }

  // ── 技能确认提交（单个任务）──
  async function handleConfirmSkillTask(filePaths: string[], skill: Skill) {
    const prompt = skill.tasks[0].prompt;

    addMessage({
      id: Date.now().toString() + '_confirm', role: 'user', content: '确认提交', timestamp: new Date(),
      type: 'submitted-summary',
      data: {
        kind: 'single',
        prompt,
        materials: filePaths.map(f => ({ path: f, type: getFileType(f) as 'image' | 'video' | 'audio' })),
        model: skill.model,
        duration: skill.duration,
        aspectRatio: skill.aspectRatio,
      },
    });
    setSubmitting(true);
    setGuidedStep('task-executing');

    try {
      // ── Kling O1 路由 ──
      if (skill.model === 'kling-o1') {
        const imagePaths = filePaths.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        if (imagePaths.length === 0) {
          addMessage({ id: Date.now().toString() + '_fail', role: 'assistant', content: '❌ Kling O1 需要至少一张图片', timestamp: new Date(), type: 'error' });
          return;
        }
        const cost = skill.duration * 10;
        if (credits.balance < cost) {
          addMessage({ id: Date.now().toString() + '_fail', role: 'assistant', content: `❌ 积分不足，需要 ${cost} 积分`, timestamp: new Date(), type: 'error' });
          return;
        }
        deductCredits(cost, `可灵 O1 技能 · ${skill.duration}s`);
        const submitId = 'kling_' + Date.now();
        addTask({ id: 'task_' + Date.now(), submitId, prompt, type: 'video', status: 'generating', progress: 0, statusMessage: '准备中...', model: 'kling-o1', duration: skill.duration, materials: imagePaths.map(p => ({ path: p, type: 'image' as const })), createdAt: Date.now(), retryCount: 0 });
        void window.api.klingGenerate({ imagePaths, prompt, duration: skill.duration, aspectRatio: skill.aspectRatio, submitId });
        showQueueToast('✅ 已加入队列，前往排队区查看进度');
        return;
      }

      // ── Seedance 路由 ──
      setStatusText('⏳ 正在提交任务...');
      if (filePaths.length > 0) {
        const materials: TaskMaterial[] = filePaths.map(f => ({ path: f, type: getFileType(f) }));
        setStatusText('📤 正在上传素材...');
        const result = await window.api.runStructuredTask({ prompt, materials, model: skill.model, duration: skill.duration, aspectRatio: skill.aspectRatio });
        if (result.success) {
          addTask({ id: 'task_' + Date.now(), submitId: (result as any).submitId, prompt, type: 'video', status: 'generating', model: skill.model, duration: skill.duration, materials: [], createdAt: Date.now(), startTime: Date.now(), retryCount: 0 });
          addMessage({ id: Date.now().toString() + '_submitted', role: 'assistant', content: `✅ 任务已提交！`, timestamp: new Date() });
        } else {
          addMessage({ id: Date.now().toString() + '_fail', role: 'assistant', content: `❌ 提交失败: ${result.error}`, timestamp: new Date(), type: 'error' });
        }
      } else {
        const result = await window.api.executeTask({ prompt, model: skill.model, duration: skill.duration, aspectRatio: skill.aspectRatio });
        if (result.success) {
          addTask({ id: 'task_' + Date.now(), submitId: (result as any).submitId, prompt, type: 'video', status: 'generating', model: skill.model, duration: skill.duration, materials: [], createdAt: Date.now(), startTime: Date.now(), retryCount: 0 });
          addMessage({ id: Date.now().toString() + '_submitted', role: 'assistant', content: '✅ 任务已提交！', timestamp: new Date() });
        } else {
          addMessage({ id: Date.now().toString() + '_fail', role: 'assistant', content: `❌ 提交失败: ${result.error}`, timestamp: new Date(), type: 'error' });
        }
      }
    } catch (err) {
      addMessage({ id: Date.now().toString() + '_fail', role: 'assistant', content: `❌ 执行出错: ${err}`, timestamp: new Date(), type: 'error' });
    } finally {
      setSubmitting(false);
      setStatusText('');
      setGuidedStep('logged-in-ready');
    }
  }

  // ── 技能确认提交（批量任务）──
  async function handleConfirmSkillBatch(filePaths: string[], skill: Skill) {
    const batchMaterialsForTask = filePaths.map(f => ({ path: f, type: getFileType(f) as 'image' | 'video' | 'audio' }));
    const mappedTasks: BatchTaskItem[] = skill.tasks.map((t, i) => ({
      id: `task_${Date.now()}_${i}`, index: i, prompt: t.prompt, reason: '',
      materials: batchMaterialsForTask, expectedEffect: t.expectedEffect || '',
      duration: skill.duration, aspectRatio: skill.aspectRatio, model: skill.model, status: 'pending' as const,
    }));
    setBatchTasks(mappedTasks);
    setTaskMode('batch');

    addMessage({
      id: Date.now().toString() + '_batch_confirm', role: 'user', content: `确认批量提交 (${skill.tasks.length} 个任务)`, timestamp: new Date(),
      type: 'submitted-summary',
      data: {
        kind: 'batch',
        prompt: skill.tasks[0]?.prompt ?? '',
        prompts: skill.tasks.map(t => t.prompt),
        materials: filePaths.map(f => ({ path: f, type: getFileType(f) as 'image' | 'video' | 'audio' })),
        model: skill.model,
        duration: skill.duration,
        aspectRatio: skill.aspectRatio,
        taskCount: skill.tasks.length,
      },
    });
    setSubmitting(true);
    setGuidedStep('task-executing');
    setStatusText('⏳ 正在创建批量任务...');

    try {
      const batch = { id: 'batch_' + Date.now(), name: skill.name, description: `技能「${skill.name}」批量任务`, totalTasks: mappedTasks.length, completedTasks: 0, status: 'pending' as const, createdAt: new Date().toISOString(), downloadDir: '' };
      const createResult = await window.api.createBatch(batch, mappedTasks);
      if (!createResult.success) throw new Error(createResult.error || '创建批量任务失败');
      const startResult = await window.api.startBatch();
      if (!startResult.success) throw new Error(startResult.error || '启动批量任务失败');
      addMessage({ id: Date.now().toString() + '_batch_started', role: 'assistant', content: `🚀 批量任务已启动！共 ${mappedTasks.length} 个任务。即梦每次最多同时生成 2 个，会自动排队逐批提交。`, timestamp: new Date() });
    } catch (err) {
      addMessage({ id: Date.now().toString() + '_batch_fail', role: 'assistant', content: `❌ 批量任务启动失败：${err}\n\n如有旧任务卡住，重新提交即可自动替换。`, timestamp: new Date(), type: 'error' });
    } finally {
      setSubmitting(false);
      setStatusText('');
      setGuidedStep('logged-in-ready');
    }
  }

  function handleCancelSkill(msgId: string) {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setGuidedStep('logged-in-ready');
  }

  // ── 保存为技能 ──
  function handleSaveSkill() {
    if (!saveSkillName.trim() || !saveSkillContext) return;
    const now = Date.now();
    if (saveSkillContext.type === 'kling') {
      addSkill({
        id: `skill_${now}`,
        name: saveSkillName.trim(),
        description: '',
        type: 'single',
        model: saveSkillContext.model || 'kling-o1',
        duration: saveSkillContext.duration || selectedDuration,
        aspectRatio: saveSkillContext.aspectRatio || selectedRatio,
        tasks: [{ prompt: saveSkillContext.prompt || '' }],
        materialSlots: saveSkillContext.materialSlots || [],
        createdAt: now,
        updatedAt: now,
        usedCount: 0,
      });
    } else if (saveSkillContext.type === 'single') {
      addSkill({
        id: `skill_${now}`,
        name: saveSkillName.trim(),
        description: '',
        type: 'single',
        model: selectedModel,
        duration: selectedDuration,
        aspectRatio: selectedRatio,
        tasks: [{ prompt: saveSkillContext.prompt || '' }],
        materialSlots: selectedFiles.map(f => ({ type: getFileType(f), path: f })),
        createdAt: now,
        updatedAt: now,
        usedCount: 0,
      });
    } else {
      const liveTasks = useStore.getState().batchTasks;
      addSkill({
        id: `skill_${now}`,
        name: saveSkillName.trim(),
        description: '',
        type: 'batch',
        model: liveTasks[0]?.model || selectedModel,
        duration: liveTasks[0]?.duration || selectedDuration,
        aspectRatio: liveTasks[0]?.aspectRatio || selectedRatio,
        tasks: liveTasks.map(t => ({ prompt: t.prompt, expectedEffect: t.expectedEffect })),
        materialSlots: (liveTasks[0]?.materials || []).map(m => ({ type: m.type as 'image' | 'video' | 'audio', path: m.path })),
        createdAt: now,
        updatedAt: now,
        usedCount: 0,
      });
    }
    setSaveSkillContext(null);
    setSaveSkillName('');
  }

  // ── 更新技能 ──
  // capturedBatchTasks: snapshot taken at button-click time to avoid stale store read
  function handleUpdateSkill(prompt?: string, capturedBatchTasks?: any[]) {
    if (!activeSkill) return;
    const prevVersion = {
      tasks: activeSkill.tasks,
      model: activeSkill.model,
      duration: activeSkill.duration,
      aspectRatio: activeSkill.aspectRatio,
      updatedAt: activeSkill.updatedAt,
    };
    if (activeSkill.type === 'single') {
      updateSkill(activeSkill.id, {
        tasks: [{ prompt: prompt || activeSkill.tasks[0]?.prompt || '' }],
        model: selectedModel,
        duration: selectedDuration,
        aspectRatio: selectedRatio,
        updatedAt: Date.now(),
        prevVersion,
      });
    } else {
      const liveTasks = (capturedBatchTasks as any) ?? useStore.getState().batchTasks;
      updateSkill(activeSkill.id, {
        tasks: liveTasks.map((t: any) => ({ prompt: t.prompt, expectedEffect: t.expectedEffect })),
        model: liveTasks[0]?.model || selectedModel,
        duration: liveTasks[0]?.duration || selectedDuration,
        aspectRatio: liveTasks[0]?.aspectRatio || selectedRatio,
        updatedAt: Date.now(),
        prevVersion,
      });
    }
    setActiveSkill(null);
  }

  function showQueueToast(msg: string) {
    setQueueToast(msg);
    setTimeout(() => setQueueToast(''), 3000);
  }

  function handleConfirmKling(data: any) {
    const { prompt, imagePaths, duration, aspectRatio, cost } = data;
    if (credits.balance < cost) {
      addMessage({
        id: Date.now().toString() + '_credits_low',
        role: 'assistant',
        content: `❌ 积分不足。需要 ${cost} 积分，当前余额 ${credits.balance}`,
        timestamp: new Date(),
        type: 'error',
      });
      return;
    }
    deductCredits(cost, `可灵 O1 · ${duration}s 视频`);
    addMessage({
      id: Date.now().toString() + '_kling_submit',
      role: 'user',
      content: '确认提交',
      timestamp: new Date(),
      type: 'submitted-summary',
      data: {
        kind: 'kling',
        prompt,
        materials: imagePaths.map((p: string) => ({ path: p, type: 'image' as const })),
        model: 'kling-o1',
        duration,
        aspectRatio,
      },
    });

    const submitId = 'kling_' + Date.now();
    addTask({
      id: 'task_' + Date.now(),
      submitId,
      prompt,
      type: 'video',
      status: 'generating',
      progress: 0,
      statusMessage: '准备中...',
      model: 'kling-o1',
      duration,
      materials: imagePaths.map((p: string) => ({ path: p, type: 'image' as const })),
      createdAt: Date.now(),
      retryCount: 0,
    });

    // Fire-and-forget: IPC returns immediately, generation runs in background
    void window.api.klingGenerate({ imagePaths, prompt, duration, aspectRatio, submitId });

    // Unlock input right away
    setSelectedFiles([]);
    setInput('');
    showQueueToast('✅ 已加入队列，前往排队区查看进度');
  }

  // Listen for progress events
  useEffect(() => {
    console.log('[前端] 注册 onProgress 监听器');
    const removeProgress = window.api.onProgress((data) => {
      console.log('[前端] 收到事件:', data.event);

      if (data.event === 'login-success') {
        // 登录成功,直接更新状态
        console.log('[前端] 处理 login-success');
        useStore.getState().setIsLoggedIn(true);
        useStore.getState().setGuidedStep('logged-in-ready');
        // 清除 QR 码消息
        setMessages((prev) => prev.filter(m => m.type !== 'qr-code'));
        addMessage({
          id: Date.now().toString() + '_login_ok',
          role: 'assistant',
          content: '✅ 登录成功！左下角可以切换三种模式：\n✨ 智能生成 — 描述想法，AI 帮你优化成提示词\n📋 批量规划 — 描述目标，AI 自动拆解成多个任务\n⚡ 专业模式 — 自己写好提示词，直接发送\n\n默认是智能生成，描述你想生成的视频效果就行。',
          timestamp: new Date(),
        });
        return;
      }

      if (data.event === 'login-start') {
        addMessage({
          id: 'login-loading',
          role: 'assistant',
          content: '正在生成二维码...',
          timestamp: new Date(),
          type: 'login-loading',
        });
        return;
      }

      if (data.event === 'login-qr-ready') {
        const qrBase64 = data.data?.qrBase64;
        if (qrBase64) {
          setMessages((prev) => prev.filter(m => m.type !== 'login-loading'));
          addMessage({
            id: Date.now().toString() + '_qr',
            role: 'assistant',
            content: '即梦 AI 使用抖音账号授权登录。请用抖音 APP 扫码，然后在 APP 内点击「确认授权」。\n\n⚠️ 需要开通即梦高级会员方可使用',
            timestamp: new Date(),
            type: 'qr-code',
            data: { qrBase64 },
          });
        }
        return;
      }

      if (data.event === 'login-scanning') {
        // CLI 有新输出 = 用户已扫码，正在等服务器确认
        // 把 QR 码消息标记为 scanning 状态，给用户即时反馈
        setMessages((prev) => prev.map(m =>
          m.type === 'qr-code' ? { ...m, data: { ...m.data, scanning: true } } : m
        ));
        return;
      }

      if (data.event === 'login-failed') {
        setMessages((prev) => prev.filter(m => m.type !== 'qr-code'));
        const errorMsg = data.data?.error || '登录失败';
        const isVipError = errorMsg.includes('高级会员') || errorMsg.includes('会员');
        addMessage({
          id: Date.now().toString() + '_login_err',
          role: 'assistant',
          content: isVipError
            ? '❌ 登录失败:即梦 CLI 需要高级会员\n\n请前往即梦网页升级会员后重试:\nhttps://jimeng.jianying.com'
            : `❌ 登录失败:${errorMsg}`,
          timestamp: new Date(),
          type: 'login-error',
          data: { isVipError, canRetry: true },
        });
        setGuidedStep('welcome');
        return;
      }

      // task events (queued/progress/result/failed/batch-*) are handled in App.tsx global listener
    });
    return () => removeProgress();
  }, []);

  async function handleSelectFiles() {
    const { files } = await window.api.selectFiles();
    if (!files?.length) return;

    // Validate format + size + duration + dedup
    const IMG_EXTS = /\.(jpg|jpeg|png|webp)$/i;
    const VID_EXTS = /\.(mp4|mov)$/i;
    const AUD_EXTS = /\.(mp3|wav|aac|m4a)$/i;
    const IMG_MAX = 30 * 1024 * 1024;   // 30 MB
    const VID_MAX = 50 * 1024 * 1024;   // 50 MB
    const AUD_MAX = 10 * 1024 * 1024;   // 10 MB
    const VID_DUR_TOTAL = 15.4;          // seconds total across all uploaded videos
    const AUD_DUR_TOTAL = 15.0;          // seconds total across all uploaded audios

    const errors: string[] = [];
    const accepted: string[] = [];

    // Track paths to catch within-batch duplicates too
    const existingPaths = new Set(selectedFiles);

    // Compute total durations already accumulated from previously selected files
    const getMediaDuration = (path: string, isVid: boolean): Promise<number> =>
      new Promise((resolve) => {
        const el = isVid ? document.createElement('video') : document.createElement('audio');
        el.preload = 'metadata';
        el.onloadedmetadata = () => resolve(isFinite(el.duration) ? el.duration : 0);
        el.onerror = () => resolve(0);
        el.src = localFileUrlSync(path);
      });

    let totalVidDur = 0;
    for (const v of selectedFiles.filter(f => VID_EXTS.test(f))) {
      totalVidDur += await getMediaDuration(v, true);
    }
    let totalAudDur = 0;
    for (const a of selectedFiles.filter(f => AUD_EXTS.test(f))) {
      totalAudDur += await getMediaDuration(a, false);
    }

    for (const f of files) {
      const name = f.split('/').pop() || f;
      const ext = name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
      const isImg = IMG_EXTS.test(f);
      const isVid = VID_EXTS.test(f);
      const isAud = AUD_EXTS.test(f);

      // Dedup check
      if (existingPaths.has(f)) {
        errors.push(`${name} 已添加，跳过重复文件`);
        continue;
      }

      if (!isImg && !isVid && !isAud) {
        errors.push(`不支持的格式 ${ext}（支持：jpg/png/webp, mp4/mov, mp3/wav/aac/m4a）`);
        continue;
      }

      // Check file size via fs — call main process
      let size = 0;
      try {
        const stat = await window.api.getFileStat(f);
        size = stat?.size || 0;
      } catch {}

      if (isImg && size > IMG_MAX) {
        errors.push(`图片 ${name} 超过 30MB 限制（当前 ${(size / 1024 / 1024).toFixed(1)}MB）`);
        continue;
      }
      if (isVid && size > VID_MAX) {
        errors.push(`视频 ${name} 超过 50MB 限制（当前 ${(size / 1024 / 1024).toFixed(1)}MB）`);
        continue;
      }
      if (isAud && size > AUD_MAX) {
        errors.push(`音频 ${name} 超过 10MB 限制（当前 ${(size / 1024 / 1024).toFixed(1)}MB）`);
        continue;
      }

      // Check duration for video/audio (Seedance 2.0 total duration limits)
      if (isVid) {
        const dur = await getMediaDuration(f, true);
        if (totalVidDur + dur > VID_DUR_TOTAL) {
          errors.push(`视频 ${name}（${dur.toFixed(1)}s）会超出总时长限制（视频总时长 ≤ 15.4s，已用 ${totalVidDur.toFixed(1)}s）`);
          continue;
        }
        totalVidDur += dur;
      }

      if (isAud) {
        const dur = await getMediaDuration(f, false);
        if (totalAudDur + dur > AUD_DUR_TOTAL) {
          errors.push(`音频 ${name}（${dur.toFixed(1)}s）会超出总时长限制（音频总时长 ≤ 15s，已用 ${totalAudDur.toFixed(1)}s）`);
          continue;
        }
        totalAudDur += dur;
      }

      accepted.push(f);
      existingPaths.add(f); // prevent within-batch duplicates
    }

    if (errors.length > 0) {
      setFileErrors(errors);
      setTimeout(() => setFileErrors([]), 5000);
    }

    if (accepted.length > 0) {
      setSelectedFiles((prev) => [...prev, ...accepted]);
      setShowParams(true);
      const { addMaterial } = useStore.getState();
      accepted.forEach((f: string) => {
        const filename = f.split('/').pop() || f;
        const isVideo = VID_EXTS.test(f);
        const isAudio = AUD_EXTS.test(f);
        addMaterial({
          id: `mat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          path: f,
          type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
          filename,
          createdAt: Date.now(),
        });
      });
    }
  }

  function handleMaterialLibrarySelect(paths: string[]) {
    setSelectedFiles((prev) => [...prev, ...paths]);
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
        content: `✅ 已下载: ${result.filePath?.split('/').pop()}`,
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
    if (e.key === 'Escape') {
      if (showMaterialLib) setShowMaterialLib(false);
      else if (showParams) setShowParams(false);
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
  const _imgCount = selectedFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
  const _vidCount = selectedFiles.filter(f => /\.(mp4|mov)$/i.test(f)).length;
  const _audCount = selectedFiles.filter(f => /\.(mp3|wav|aac|m4a)$/i.test(f)).length;
  const canAddFiles = canInput && _imgCount < 9 && _vidCount < 3 && _audCount < 3;
  const showInputArea = ['logged-in-ready', 'task-drafting', 'task-confirming', 'task-executing', 'task-done', 'batch-collecting'].includes(guidedStep);

  return (
    <div className="flex flex-col h-full bg-surface-0 relative">
      {/* Material Library popup */}
      <MaterialLibrary
        visible={showMaterialLib}
        onClose={() => setShowMaterialLib(false)}
        onSelect={handleMaterialLibrarySelect}
      />

      {/* Onboarding Overlay (问题6) */}
      {showOnboarding && <OnboardingOverlay onDismiss={handleDismissOnboarding} isLoggedIn={!!useStore.getState().isLoggedIn} />}

      {/* Lightbox */}
      {viewFile && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{ background: 'oklch(0.03 0.005 250 / 0.92)' }}
          onClick={() => setViewFile(null)}
        >
          <button
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[oklch(0.22_0.01_250)] hover:bg-[oklch(0.28_0.01_250)] flex items-center justify-center transition-colors"
            onClick={() => setViewFile(null)}
          >
            <X size={15} className="text-[var(--color-text-muted,oklch(0.65_0.01_250))]" />
          </button>
          {isVideoFile(viewFile) ? (
            <video
              src={localFileUrlSync(viewFile)}
              controls
              autoPlay
              className="max-w-[90vw] max-h-[85vh] rounded-lg"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img
              src={localFileUrlSync(viewFile)}
              alt="preview"
              className="max-w-[90vw] max-h-[85vh] rounded-lg object-contain"
              onClick={e => e.stopPropagation()}
            />
          )}
        </div>
      )}
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
        <div className="flex items-center gap-2">
          {/* Download folder shortcut */}
          <button
            onClick={() => window.api.openDownloadDir()}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
            title="打开下载目录"
          >
            <FolderOpen size={15} />
          </button>
          {/* 进度可视化 */}
          <div className="text-xs text-text-secondary">
            {getProgressText(guidedStep)}
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
                  onConfirm={msg.type === 'ai-rewrite' && msg.data && guidedStep === 'task-confirming' ? handleConfirmTask : msg.type === 'batch-confirm' && msg.data ? () => handleConfirmBatch(msg.data) : undefined}
                  onEdit={
                    msg.type === 'ai-rewrite' && msg.data && guidedStep === 'task-confirming'
                      ? () => handleEditTask(msg.id)
                      : msg.type === 'batch-confirm' && msg.data
                        ? () => handleEditBatchConfirm(msg.id)
                        : undefined
                  }
                  onRetry={msg.type === 'error' && lastPrompt ? handleRetry : undefined}
                  onLoginRetry={msg.type === 'login-error' ? handleLoginRetry : undefined}
                  task={msg.type === 'ai-rewrite' ? msg.data : undefined}
                  selectedModel={selectedModel}
                  selectedDuration={selectedDuration}
                  selectedRatio={selectedRatio}
                  onDurationChange={setSelectedDuration}
                  onRatioChange={setSelectedRatio}
                  onModelChange={setSelectedModel}
                  onEditMaterial={handleEditMaterial}
                  setGuidedStep={setGuidedStep}
                  setMessages={setMessages}
                  setTaskMode={setTaskMode}
                  onInputRestore={() => setInput(lastInput)}
                  onSaveAsSkill={(msg.type === 'ai-rewrite' || msg.type === 'batch-confirm' || msg.type === 'kling-confirm') ? (prompt?: string) => setSaveSkillContext({ type: msg.type === 'batch-confirm' ? 'batch' : msg.type === 'kling-confirm' ? 'kling' : 'single', prompt }) : undefined}
                  onUpdateSkill={activeSkill && (msg.type === 'ai-rewrite' || msg.type === 'batch-confirm') ? (prompt?: string) => handleUpdateSkill(prompt, useStore.getState().batchTasks) : undefined}
                  activeSkillName={activeSkill?.name}
                  onConfirmKling={msg.type === 'kling-confirm' ? handleConfirmKling : undefined}
                  onConfirmSkill={msg.type === 'skill-confirm' ? (files, sk) => {
                    if (sk.type === 'batch' && sk.tasks.length > 1) {
                      handleConfirmSkillBatch(files, sk);
                    } else {
                      handleConfirmSkillTask(files, sk);
                    }
                  } : undefined}
                  onCancelSkill={msg.type === 'skill-confirm' ? handleCancelSkill : undefined}
                />
              </div>
            ))}

            {isSubmitting && (
              <div className="flex justify-start animate-fade-in">
                <div className="msg-ai rounded-md px-4 py-3 max-w-xs">
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
      {/* Jimeng-style unified input card */}
      {/* Queue toast */}
      {queueToast && (
        <div className="mx-4 mb-1 px-3 py-2 rounded-lg bg-success/15 border border-success/30 text-xs text-success flex items-center gap-2 animate-fade-in">
          {queueToast}
        </div>
      )}

      {showInputArea && (
        <div className="px-4 py-3 flex-shrink-0">
          <div className="rounded-xl border border-border bg-surface-2 transition-all duration-200 input-card-focus shadow-[var(--shadow-card)]">

            {/* Active skill banner */}
            {activeSkill && canInput && (
              <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
                <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 bg-brand/10 border border-brand/20 rounded-md">
                  <span className="text-brand text-xs">⚡</span>
                  <span className="text-xs text-brand font-medium flex-1 truncate">{activeSkill.name}</span>
                  <span className="text-[10px] text-text-muted">{activeSkill.tasks.length > 1 ? `批量 · ${activeSkill.tasks.length} 条` : '单个'} · {activeSkill.model === 'seedance2.0fast' ? 'Fast' : '2.0'} · {activeSkill.duration}s · {activeSkill.aspectRatio}</span>
                  <button onClick={() => setActiveSkill(null)} className="text-text-muted hover:text-error transition-colors ml-1"><X size={12} /></button>
                </div>
              </div>
            )}

            {/* Main row: attachment stack (only when files present) + textarea */}
            <div className="flex gap-0 p-3 pb-2" style={{ overflow: 'visible' }}>

              {/* Attachment stack — always on LEFT */}
              <div className="flex-shrink-0 mr-3 self-center" style={{ overflow: 'visible' }}>
                <AttachmentStack
                  files={selectedFiles}
                  onView={setViewFile}
                  onRemove={removeFile}
                  onAdd={handleSelectFiles}
                  canAdd={canAddFiles}
                />
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={canInput ? handleKeyDown : undefined}
                placeholder={
                  !canInput ? '请先完成当前步骤...' :
                  activeSkill ? `上传素材后直接发送，使用「${activeSkill.name}」技能生成...` :
                  sendMode === 'ai-batch' ? '描述这次要批量生成什么，比如：5 个不同风格的产品展示视频…' :
                  sendMode === 'direct' ? (selectedModel === 'kling-o1' ? '直接输入可灵提示词，按工具栏参数执行…' : '直接输入 Seedance 提示词，按工具栏参数执行…') :
                  '描述你想生成的视频效果，比如：黄昏海边的慢镜头，温暖色调…'
                }
                rows={3}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-text-primary placeholder-text-secondary leading-relaxed"
                style={{ minHeight: '68px', maxHeight: '160px' }}
                disabled={!canInput}
              />
            </div>

            {/* File validation errors */}
            {fileErrors.length > 0 && (
              <div className="px-3 pb-1">
                {fileErrors.map((err, i) => (
                  <div key={i} className="text-[10px] text-error flex items-center gap-1 leading-tight mb-0.5">
                    <AlertTriangle size={9} /> {err}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom toolbar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border-subtle">
              <PillSelect
                icon={sendMode === 'ai-single' ? <Sparkles size={10} /> : sendMode === 'ai-batch' ? <Layers size={10} /> : <Zap size={10} />}
                label={sendMode === 'ai-single' ? '智能生成' : sendMode === 'ai-batch' ? '批量规划' : '专业模式'}
                options={[
                  { value: 'ai-single', label: '✨ 智能生成', desc: '描述想法，AI 帮你优化成提示词' },
                  { value: 'ai-batch', label: '📋 批量规划', desc: '描述项目目标，AI 自动拆解成多个任务' },
                  { value: 'direct', label: '⚡ 专业模式', desc: '自己写好提示词，直接发送' },
                ]}
                value={sendMode}
                onChange={(v) => setSendMode(v as SendMode)}
                disabled={!canInput}
              />
              <PillSelect
                icon={<Zap size={10} />}
                label={selectedModel === 'kling-o1' ? '可灵 O1' : selectedModel === 'seedance2.0fast' ? 'Seedance 2.0 Fast' : 'Seedance 2.0'}
                options={[
                  { value: 'seedance2.0fast', label: 'Seedance 2.0 Fast', desc: '即梦 · 最快速度' },
                  { value: 'seedance2.0', label: 'Seedance 2.0', desc: '即梦 · 标准质量' },
                  { value: 'kling-o1', label: '可灵 O1 · 图生视频', desc: `图生视频 · ${selectedDuration * 10} 积分/${selectedDuration}s · 需上传图片` },
                ]}
                value={selectedModel}
                onChange={setSelectedModel}
                disabled={!canInput}
              />
              {/* Credit cost badge for Kling O1 */}
              {selectedModel === 'kling-o1' && (
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border ${
                  credits.balance >= selectedDuration * 10
                    ? 'border-brand/30 text-brand bg-brand/10'
                    : 'border-error/30 text-error bg-error/10'
                }`}>
                  <Zap size={9} />
                  <span>{selectedDuration * 10}</span>
                </div>
              )}
              <PillTag label="全能参考" icon={<Layers size={10} />} />
              <PillSelect
                icon={<RectangleHorizontal size={10} />}
                label={selectedRatio}
                options={['9:16','16:9','1:1','4:3','3:4','21:9'].map(r => ({ value: r, label: r }))}
                value={selectedRatio}
                onChange={setSelectedRatio}
                disabled={!canInput}
              />
              <PillSelect
                icon={<Clock size={10} />}
                label={`${selectedDuration}s`}
                options={[4,5,6,7,8,9,10,11,12,13,14,15].map(d => ({ value: String(d), label: `${d}s` }))}
                value={String(selectedDuration)}
                onChange={(v) => setSelectedDuration(Number(v))}
                disabled={!canInput}
              />

              <div className="flex-1" />

              {/* ⚡ Skill button */}
              <button
                onClick={() => setShowSkillPicker(true)}
                disabled={!canInput}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-all disabled:opacity-30 ${activeSkill ? 'text-brand bg-brand/10 hover:bg-brand/20' : 'text-text-muted hover:text-brand hover:bg-brand/10'}`}
                title="应用技能"
              >
                <span>⚡</span>
                <span className="hidden sm:inline">技能</span>
              </button>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !activeSkill && !(selectedModel === 'kling-o1' && selectedFiles.some(f => /\.(jpg|jpeg|png|webp)$/i.test(f)))) || !canInput}
                className="w-8 h-8 rounded-full bg-brand hover:bg-brand/90 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95"
              >
                <ArrowUp size={15} />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── Skill Picker Modal ── */}
      {showSkillPicker && (
        <SkillPickerModal
          onSelect={(skill) => handleApplySkill(skill)}
          onClose={() => setShowSkillPicker(false)}
        />
      )}

      {/* ── Save as Skill Modal ── */}
      {saveSkillContext && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={() => { setSaveSkillContext(null); setSaveSkillName(''); }}>
          <div
            className="bg-surface-1 border border-border rounded-xl p-5 w-full max-w-sm shadow-2xl mx-4 mb-4 sm:mb-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-brand">⚡</span>
              <h3 className="text-sm font-semibold text-text-primary">
                保存为技能
              </h3>
              <span className="text-[10px] text-text-muted ml-1">
                {saveSkillContext.type === 'batch' ? `批量 · ${useStore.getState().batchTasks.length} 条` : saveSkillContext.type === 'kling' ? '可灵 O1 · 单个' : '单个任务'}
              </span>
            </div>
            <input
              value={saveSkillName}
              onChange={e => setSaveSkillName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveSkill()}
              placeholder="给这个技能起个名字..."
              className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-primary outline-none focus:border-brand transition-colors mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setSaveSkillContext(null); setSaveSkillName(''); }}
                className="px-4 py-2 text-xs text-text-secondary bg-surface-2 hover:bg-border rounded-md transition-all">
                取消
              </button>
              <button
                onClick={handleSaveSkill}
                disabled={!saveSkillName.trim()}
                className="px-4 py-2 text-xs text-white bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-all"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Skill Picker Modal ──
function SkillPickerModal({ onSelect, onClose }: { onSelect: (skill: Skill) => void; onClose: () => void }) {
  const skills = useStore(s => s.skills);
  const setActivePanel = useStore(s => s.setActivePanel);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-1 border border-border rounded-xl w-full max-w-sm mx-4 mb-4 sm:mb-0 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <span className="text-brand">⚡</span>
            <h3 className="text-sm font-semibold text-text-primary">选择技能</h3>
          </div>
          <button onClick={() => { onClose(); setActivePanel('skills'); }}
            className="text-[11px] text-brand hover:text-brand/80 transition-colors">
            管理技能库 →
          </button>
        </div>

        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <p className="text-sm text-text-muted mb-3">还没有保存任何技能</p>
            <button
              onClick={() => { onClose(); setActivePanel('skills'); }}
              className="text-xs text-brand hover:underline"
            >
              前往技能库创建 →
            </button>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto p-2">
            {skills.map(skill => (
              <button
                key={skill.id}
                onClick={() => onSelect(skill)}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-surface-2 transition-all text-left group"
              >
                <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-brand/20 transition-colors">
                  <span className="text-brand text-xs">⚡</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{skill.name}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {skill.tasks.length > 1 ? `批量 · ${skill.tasks.length} 条` : '单个'} · {skill.duration}s · {skill.aspectRatio}
                    {skill.usedCount > 0 && ` · 用了 ${skill.usedCount} 次`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step Description ──
function getStepDescription(step: GuidedStep): string {
  switch (step) {
    case 'welcome': return '等待开始';
    case 'checking-login': return '正在检查登录状态...';
    case 'opening-browser': return '正在打开浏览器...';
    case 'waiting-login': return '等待扫码登录';
    case 'logged-in-ready': return '就绪,等待输入';
    case 'mode-selecting': return '选择模式';
    case 'batch-collecting': return '描述批量需求';
    case 'batch-confirming': return '确认批量任务';
    case 'task-drafting': return 'AI 正在优化提示词...';
    case 'task-confirming': return '等待确认';
    case 'task-executing': return '正在执行...';
    case 'task-done': return '任务完成';
    default: return '';
  }
}

// ── Progress Text (进度可视化) ──
function getProgressText(step: GuidedStep): string {
  const stepMap: Record<GuidedStep, { step: number; label: string }> = {
    'welcome': { step: 1, label: '登录' },
    'checking-login': { step: 1, label: '登录' },
    'opening-browser': { step: 1, label: '登录' },
    'waiting-login': { step: 1, label: '登录' },
    'logged-in-ready': { step: 2, label: '选择模式' },
    'mode-selecting': { step: 2, label: '选择模式' },
    'batch-collecting': { step: 3, label: '描述需求' },
    'batch-confirming': { step: 4, label: '确认任务' },
    'batch-executing': { step: 5, label: '执行中' },
    'task-drafting': { step: 3, label: '描述需求' },
    'task-confirming': { step: 4, label: '确认任务' },
    'task-executing': { step: 5, label: '执行中' },
    'task-done': { step: 5, label: '完成' },
  };
  const info = stepMap[step] || { step: 0, label: '' };
  return info.step > 0 ? `步骤 ${info.step}/5 ${info.label}` : '';}

// ── Message Bubble ──
// ── Kling Confirm Card ────────────────────────────────────────────────────────

// ── Model short-label map ────────────────────────────────────────────────────
const MODEL_LABELS: Record<string, string> = {
  'seedance2.0fast': 'Seedance Fast',
  'seedance2.0':     'Seedance 2.0',
  'kling-o1':        'Kling O1',
};
function modelLabel(m: string) { return MODEL_LABELS[m] || m; }

// ── SubmittedSummaryBubble ───────────────────────────────────────────────────
function SubmittedSummaryBubble({ data }: {
  data: {
    kind: 'single' | 'batch' | 'kling';
    prompt: string;
    materials?: Array<{ path: string; type: 'image' | 'video' | 'audio' }>;
    model?: string;
    duration?: number;
    aspectRatio?: string;
    taskCount?: number;       // batch
    prompts?: string[];       // batch preview
  };
}) {
  const MAX_THUMBS = 4;
  const mats = data.materials ?? [];
  const shown = mats.slice(0, MAX_THUMBS);
  const extra = mats.length - MAX_THUMBS;

  const isBatch = data.kind === 'batch';
  const headerLabel = isBatch ? `批量提交  ·  ${data.taskCount ?? data.prompts?.length ?? 0} 个任务` : '已提交';

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-md overflow-hidden bg-brand/85 text-white text-sm shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <span className="text-[11px] font-medium text-white/80 flex items-center gap-1">
            <CheckCircle size={11} className="text-white/60" />
            {headerLabel}
          </span>
          {data.model && (
            <span className="text-[10px] text-white/55 bg-white/10 px-1.5 py-0.5 rounded">
              {modelLabel(data.model)}
            </span>
          )}
        </div>

        {/* Prompt (single/kling) or task previews (batch) */}
        <div className="px-3 pt-2.5 pb-1">
          {isBatch && data.prompts?.length ? (
            <ul className="space-y-0.5">
              {data.prompts.slice(0, 3).map((p, i) => (
                <li key={i} className="text-xs text-white/80 line-clamp-1">
                  <span className="text-white/40 mr-1">{i + 1}.</span>{p}
                </li>
              ))}
              {(data.prompts.length > 3) && (
                <li className="text-[10px] text-white/40">+{data.prompts.length - 3} 个任务</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-white leading-relaxed line-clamp-3">{data.prompt}</p>
          )}
        </div>

        {/* Material thumbnails */}
        {shown.length > 0 && (
          <div className="px-3 pt-1.5 pb-1 flex gap-1.5 flex-wrap">
            {shown.map((m, i) => (
              <div key={i} className="w-10 h-10 rounded-md overflow-hidden border border-white/15 flex-shrink-0 bg-black/20">
                {m.type === 'image' ? (
                  <img src={localFileUrlSync(m.path)} alt="" className="w-full h-full object-cover" />
                ) : m.type === 'video' ? (
                  <VideoThumb path={m.path} size={20} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-white/50 text-base">♪</span>
                  </div>
                )}
              </div>
            ))}
            {extra > 0 && (
              <div className="w-10 h-10 rounded-md border border-white/15 bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] text-white/60">+{extra}</span>
              </div>
            )}
          </div>
        )}

        {/* Param tags */}
        {(data.aspectRatio || data.duration) && (
          <div className="px-3 pt-1 pb-2.5 flex gap-1.5 flex-wrap">
            {data.aspectRatio && (
              <span className="text-[10px] text-white/50 bg-white/8 border border-white/10 px-1.5 py-0.5 rounded">
                {data.aspectRatio}
              </span>
            )}
            {data.duration && (
              <span className="text-[10px] text-white/50 bg-white/8 border border-white/10 px-1.5 py-0.5 rounded">
                {data.duration}s
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


function MessageBubble({ msg, onDownload, onGuideClick, onConfirm, onEdit, onRetry, onLoginRetry, task, selectedModel, selectedDuration, selectedRatio, onDurationChange, onRatioChange, onModelChange, onEditMaterial, setGuidedStep, setMessages, setTaskMode, onInputRestore, onSaveAsSkill, onUpdateSkill, activeSkillName, onConfirmKling, onConfirmSkill, onCancelSkill }: {
  msg: Message;
  onDownload?: () => void;
  onGuideClick?: () => void;
  onConfirm?: (editedPrompt?: string) => void;
  onEdit?: () => void;
  onRetry?: () => void;
  onLoginRetry?: () => void;
  task?: any;
  selectedModel?: string;
  selectedDuration?: number;
  selectedRatio?: string;
  onDurationChange?: (d: number) => void;
  onRatioChange?: (r: string) => void;
  onModelChange?: (m: string) => void;
  onEditMaterial?: (index: number, newDesc: string) => void;
  setGuidedStep?: (step: any) => void;
  setMessages?: (fn: (prev: Message[]) => Message[]) => void;
  setTaskMode?: (mode: any) => void;
  onInputRestore?: () => void;
  onSaveAsSkill?: (prompt?: string) => void;
  onUpdateSkill?: (prompt?: string) => void;
  activeSkillName?: string;
  onConfirmKling?: (data: any) => void;
  onConfirmSkill?: (files: string[], skill: Skill) => void;
  onCancelSkill?: (msgId: string) => void;
}) {
  const isUser = msg.role === 'user';
  const isSystem = msg.role === 'system';

  // System messages - minimal, centered
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
        <div className="max-w-[85%] rounded-md px-4 py-3 msg-ai text-text-primary">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          <div className="mt-3">
            <GuideButton label="准备好了" onClick={onGuideClick} />
          </div>
        </div>
      </div>
    );
  }

  // Login loading message
  if (msg.type === 'login-loading') {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-md px-4 py-3 msg-ai text-text-primary">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span className="inline-flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-bounce [animation-delay:300ms]" />
            </span>
            {msg.content}
          </div>
        </div>
      </div>
    );
  }

  // QR code message
  if (msg.type === 'qr-code' && msg.data?.qrBase64) {
    const isLoggedIn = useStore.getState().isLoggedIn;
    const scanning = !!msg.data?.scanning;
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-md px-4 py-3 msg-ai text-text-primary">
          <p className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{msg.content}</p>

          {/* QR 图 or 验证中状态 */}
          {scanning ? (
            <div className="w-48 h-48 mx-auto flex flex-col items-center justify-center gap-3 border border-border rounded-md bg-surface-1">
              <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-text-primary">正在验证身份</p>
              <p className="text-[11px] text-text-muted text-center px-4">已收到扫码请求，请在抖音 APP 中确认授权</p>
            </div>
          ) : (
            <>
              <img
                src={msg.data.qrBase64}
                alt="登录二维码"
                className="w-48 h-48 mx-auto border border-border rounded-md"
              />
              <p className="text-xs text-text-muted mt-2 text-center">打开抖音 APP 扫码授权</p>
              <p className="text-[11px] text-text-disabled mt-1 text-center">扫码后请稍候 3–10 秒，等待服务器验证</p>
            </>
          )}

          {/* 取消按钮 */}
          {!scanning && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <button
                onClick={() => {
                  useStore.getState().setGuidedStep('welcome');
                  const timer = (window as any).__loginPollTimer;
                  if (timer) clearInterval(timer);
                }}
                className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface-3 hover:bg-border rounded-lg transition-all"
              >
                取消登录
              </button>
              {isLoggedIn && (
                <button
                  onClick={() => useStore.getState().setGuidedStep('checking-login')}
                  className="px-3 py-1.5 text-xs text-brand hover:text-brand-light bg-brand/10 hover:bg-brand/20 rounded-lg transition-all"
                >
                  切换账号
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Login error message
  if (msg.type === 'login-error') {
    const isVipError = msg.data?.isVipError;
    const canRetry = msg.data?.canRetry;

    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-md px-4 py-3 bg-surface-2 border border-error/30 text-text-primary">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>

          {isVipError && (
            <a
              href="https://jimeng.jianying.com"
              target="_blank"
              className="inline-flex items-center gap-1 mt-3 text-xs text-brand hover:text-brand-light transition-colors"
            >
              前往即梦网页升级会员 →
            </a>
          )}

          {canRetry && (
            <button
              onClick={onLoginRetry}
              className="mt-3 px-4 py-2 text-xs rounded-lg bg-surface-3 hover:bg-surface-1 border border-border-subtle transition-colors"
            >
              重新登录
            </button>
          )}
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
                content: '好的,批量任务模式。请告诉我:\n\n1. 这次批量测试的目标是什么?\n2. 你想生成多少个视频?\n3. 每个视频的测试重点分别是什么?',
                timestamp: new Date(),
              });
            } else {
              useStore.getState().setGuidedStep('logged-in-ready');
              useStore.getState().addMessage({
                id: Date.now().toString() + '_single_ready',
                role: 'assistant',
                content: '好的,单个任务模式。请描述你想生成的视频。',
                timestamp: new Date(),
              });
            }
          }}
        />
      </div>
    );
  }

  // Batch confirm card
  if (msg.type === 'batch-confirm') {
    const data = msg.data as any;
    return (
      <div className="flex justify-start">
        <BatchConfirmCard
          batchName={data?.batchName || '批量任务'}
          description={data?.description || ''}
          materials={data?.materials || []}
          modelHint={data?.selectedModel}
          onConfirm={onConfirm || (() => {})}
          onEdit={onEdit || (() => {})}
        />
      </div>
    );
  }

  // Skill confirm card
  if (msg.type === 'skill-confirm' && msg.data) {
    const { skill, initialFiles } = msg.data as { skill: Skill; initialFiles: string[] };
    return (
      <div className="flex justify-start">
        <SkillConfirmCard
          msgId={msg.id}
          skill={skill}
          initialFiles={initialFiles}
          onConfirmTask={onConfirmSkill ?? (() => {})}
          onConfirmBatch={onConfirmSkill ?? (() => {})}
          onCancel={onCancelSkill ?? (() => {})}
        />
      </div>
    );
  }

  // Kling O1 confirm card
  if (msg.type === 'kling-confirm' && msg.data) {
    const data = msg.data as any;
    return (
      <div className="flex justify-start">
        <KlingConfirmCard
          data={data}
          onConfirm={(updated) => onConfirmKling?.({ ...data, ...updated })}
          onCancel={() => {}}
        />
      </div>
    );
  }

  // Clarification card (追问卡片)
  if (msg.type === 'clarification' && (msg.data as any)?.questions) {
    const data = msg.data as any;
    return (
      <div className="flex justify-start">
        <div className="bg-surface-2 border border-accent/30 rounded-md overflow-hidden max-w-[85%] animate-fade-in-up">
          <div className="h-px bg-accent flex-shrink-0" />
          <div className="p-4">
            <p className="text-xs text-accent font-medium mb-3 flex items-center gap-1.5">
              <span>🤔</span> 请确认素材用途
            </p>
            
            {/* 显示推断的素材列表 */}
            {(data.materials || []).length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">已上传素材</p>
                <div className="flex flex-wrap gap-2">
                  {(data.materials || []).map((m: any, i: number) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      {m.type === 'image' && (
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-border bg-surface-3">
                          <img src={localFileUrlSync(m.path)} alt={m.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      {m.type === 'video' && (
                        <div className="w-14 h-14 rounded-lg overflow-hidden border border-border">
                          <VideoThumb path={m.path} size={32} />
                        </div>
                      )}
                      {m.type === 'audio' && (
                        <div className="w-14 h-14 rounded-lg border border-border bg-surface-3 flex items-center justify-center">
                          <span className="text-purple-400 text-lg">♪</span>
                        </div>
                      )}
                      <span className="text-[9px] text-text-muted max-w-[56px] truncate text-center">{m.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 追问问题 */}
            <div className="space-y-3">
              {(data.questions || []).map((q: any) => (
                <div key={q.id}>
                  <p className="text-xs text-text-primary mb-2">{q.text}</p>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt: any) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          // TODO: 保存用户选择，重新生成提示词
                          console.log('User selected:', q.id, opt.value);
                        }}
                        className="px-3 py-1.5 text-xs bg-surface-3 hover:bg-border text-text-secondary rounded-lg transition-all"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 确认按钮 */}
            <div className="mt-4">
              <button
                onClick={() => {
                  // TODO: 根据用户选择重新生成提示词
                  console.log('User confirmed clarification');
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand/90 text-white text-xs font-medium rounded-md transition-all"
              >
                <CheckCircle size={14} />
                确认并生成
              </button>
            </div>
          </div>
        </div>
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
          selectedModel={selectedModel ?? (task as any).selectedModel}
          selectedDuration={selectedDuration ?? (task as any).selectedDuration}
          selectedRatio={selectedRatio ?? (task as any).selectedRatio}
          materials={(task as any).materials}
          onDurationChange={onDurationChange}
          onRatioChange={onRatioChange}
          onModelChange={onModelChange}
          onEditMaterial={onEditMaterial}
        />
      </div>
    );
  }

  // Submitted summary bubble
  if (msg.type === 'submitted-summary' && msg.data) {
    return <SubmittedSummaryBubble data={msg.data} />;
  }

  // User vs Assistant messages
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-md px-4 py-3 transition-all ${
          isUser
            ? 'bg-brand text-white'
            : msg.type === 'error'
            ? 'bg-error/10 text-error border border-error/20'
            : 'msg-ai text-text-primary'
        }`}
      >
        {/* Material thumbnails for user messages */}
        {isUser && msg.data?.materials?.length > 0 && (
          <MaterialThumbs materials={msg.data.materials} />
        )}

        {msg.content && (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        )}

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
          <div className="flex items-center gap-2 mt-2.5">
            {msg.data.url && (
              <button
                onClick={() => useStore.getState().setPreviewUrl(msg.data.url)}
                className="flex items-center gap-1.5 text-xs text-accent-light hover:text-accent transition-colors font-medium"
              >
                <Play size={13} />
                预览
              </button>
            )}
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 text-xs text-accent-light hover:text-accent transition-colors font-medium"
            >
              <Download size={13} />
              下载到本地
            </button>
          </div>
        )}

        <p className={`text-[10px] mt-1.5 ${isUser ? 'text-white/40' : 'text-text-disabled'}`}>
          {msg.timestamp.toLocaleTimeString('zh-CN')}
        </p>
      </div>
    </div>
  );
}
