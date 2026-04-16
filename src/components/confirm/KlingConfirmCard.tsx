import { useState } from 'react';
import { Zap } from 'lucide-react';
import { useStore } from '../../store';
import { localFileUrlSync } from '../../utils/localFile';
import { SaveSkillModal } from './SaveSkillModal';

function cyclePill<T>(current: T, options: T[]): T {
  const idx = options.indexOf(current);
  return options[(idx + 1) % options.length];
}

const RATIO_OPTIONS = ['9:16', '16:9', '1:1'];
const DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

interface KlingData {
  prompt: string;
  imagePaths: string[];
  duration: number;
  aspectRatio: string;
  cost: number;
}

export function KlingConfirmCard({ data, onConfirm, onCancel }: {
  data: KlingData;
  onConfirm: (updated: { prompt: string; duration: number; aspectRatio: string }) => void;
  onCancel: () => void;
}) {
  const { credits } = useStore();
  const [prompt, setPrompt] = useState(data.prompt);
  const [duration, setDuration] = useState(data.duration);
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const cost = duration * 10;
  const canAfford = credits.balance >= cost;

  return (
    <>
      <div className="bg-surface-2 border border-border-subtle rounded-xl overflow-hidden max-w-[85%] animate-fade-in-up">
        <div className="h-px bg-brand" />
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-brand flex items-center gap-1.5">
              <Zap size={11} /> 可灵 O1 · 图生视频
            </span>
          </div>

          {/* Clickable pills */}
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-surface-3 rounded text-[10px] text-text-secondary font-mono">Kling O1</span>
            <button onClick={() => setDuration(cyclePill(duration, DURATION_OPTIONS))} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换时长">
              {duration}s
            </button>
            <button onClick={() => setAspectRatio(cyclePill(aspectRatio, RATIO_OPTIONS))} className="px-2 py-0.5 bg-surface-3 hover:bg-border rounded text-[10px] text-text-secondary font-mono transition-colors" title="点击切换比例">
              {aspectRatio}
            </button>
          </div>

          {/* Image thumbnails */}
          <div className="flex gap-1.5 flex-wrap">
            {data.imagePaths.slice(0, 7).map((p, i) => (
              <div key={i} className="w-12 h-12 rounded-md overflow-hidden bg-surface-3 shrink-0 border border-border-subtle">
                <img src={localFileUrlSync(p)} className="w-full h-full object-cover" alt="" />
              </div>
            ))}
          </div>

          {/* Editable prompt */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="输入提示词（可选）..."
            className="w-full bg-surface-3 border border-border-subtle rounded-lg px-2.5 py-2 text-xs text-text-primary leading-relaxed resize-none outline-none focus:border-brand transition-colors"
            rows={3}
          />

          {/* Credit cost */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${canAfford ? 'bg-brand/10 border border-brand/20' : 'bg-error/10 border border-error/20'}`}>
            <div className="flex items-center gap-1.5">
              <Zap size={11} className={canAfford ? 'text-brand' : 'text-error'} />
              <span className={`text-[11px] font-medium ${canAfford ? 'text-brand' : 'text-error'}`}>消耗 {cost} 积分</span>
            </div>
            <span className={`text-[10px] ${canAfford ? 'text-text-muted' : 'text-error'}`}>
              余额 {credits.balance.toLocaleString()} {!canAfford && '· 不足'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-0.5">
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-2 bg-surface-3 hover:bg-brand/10 text-text-muted hover:text-brand text-xs rounded-lg transition-colors border border-border-subtle hover:border-brand/30"
            >
              <Zap size={11} className="inline mr-1" />保存为技能
            </button>
            <div className="flex-1" />
            <button onClick={onCancel} className="px-4 py-2 bg-surface-3 hover:bg-border text-text-secondary text-xs rounded-lg transition-colors">
              取消
            </button>
            <button
              onClick={() => onConfirm({ prompt, duration, aspectRatio })}
              disabled={!canAfford}
              className="flex-1 py-2 bg-brand hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-medium rounded-lg transition-all"
            >
              确认生成
            </button>
          </div>
        </div>
      </div>

      {showSaveModal && (
        <SaveSkillModal
          onClose={() => setShowSaveModal(false)}
          tasks={[{ prompt }]}
          model="kling-o1"
          duration={duration}
          aspectRatio={aspectRatio}
        />
      )}
    </>
  );
}
