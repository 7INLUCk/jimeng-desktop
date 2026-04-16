import { X } from 'lucide-react';

interface VideoModalProps {
  url: string | null;
  onClose: () => void;
}

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?|$)/i;

export function VideoModal({ url, onClose }: VideoModalProps) {
  if (!url) return null;

  const isImage = IMAGE_EXTS.test(url);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center animate-overlay-in"
      style={{ background: 'oklch(0.05 0.01 250 / 0.8)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[90vw] max-w-4xl animate-card-pop"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <X size={20} />
        </button>

        {isImage ? (
          <img
            src={url}
            alt=""
            className="w-full rounded-md object-contain"
            style={{ maxHeight: '80vh', boxShadow: 'var(--shadow-lg)' }}
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="w-full rounded-md"
            style={{ maxHeight: '80vh', boxShadow: 'var(--shadow-lg)' }}
          >
            您的浏览器不支持视频播放
          </video>
        )}
      </div>
    </div>
  );
}
