import { useState, useEffect, useRef } from 'react';
import { Video } from 'lucide-react';
import { localFileUrl } from '../../utils/localFile';

export function VideoThumb({ path, size = 48, onClick }: { path: string; size?: number; onClick?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumb, setThumb] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const onMeta = () => {
      if (cancelled) return;
      if (isFinite(video.duration)) setDuration(video.duration);
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
        if (dataUrl && dataUrl !== 'data:,') setThumb(dataUrl);
      } catch (e) {
        console.warn('[VideoThumb] drawImage failed:', e);
      }
    };

    const onSeeked = () => {
      if (cancelled) return;
      requestAnimationFrame(capture);
    };

    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('seeked', onSeeked);

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
