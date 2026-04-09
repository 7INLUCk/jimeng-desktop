import { useState, useCallback } from 'react';
import { Image, Film, Trash2, X, Check } from 'lucide-react';
import { useStore, type SavedMaterial } from '../store';

interface MaterialLibraryProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (paths: string[]) => void;
}

export function MaterialLibrary({ visible, onClose, onSelect }: MaterialLibraryProps) {
  const { materials, removeMaterial } = useStore();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!visible) return null;

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const paths = materials.filter(m => selected.has(m.id)).map(m => m.path);
    onSelect(paths);
    setSelected(new Set());
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-end justify-center animate-overlay-in"
      style={{ background: 'oklch(0.05 0.01 250 / 0.8)' }}
      onClick={onClose}
    >
      <div
        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-t-md w-full max-w-lg max-h-[60vh] flex flex-col animate-card-pop"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">素材库</h3>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1 px-3 py-1 bg-[var(--color-brand)] text-white text-xs rounded-md hover:shadow-[var(--shadow-brand-sm)] transition-all"
              >
                <Check size={12} />
                选中 {selected.size} 个
              </button>
            )}
            <button onClick={onClose} className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Image size={28} className="text-[var(--color-text-secondary)] mb-2" />
              <p className="text-xs text-[var(--color-text-muted)]">还没有上传过素材</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {materials.map((mat) => {
                const isSelected = selected.has(mat.id);
                const isImage = mat.type === 'image';
                return (
                  <div
                    key={mat.id}
                    className={`relative group rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                      isSelected ? 'border-[var(--color-brand)] shadow-[var(--shadow-brand-sm)]' : 'border-[var(--color-border-subtle)] hover:border-[var(--color-border)]'
                    }`}
                    onClick={() => toggleSelect(mat.id)}
                  >
                    <div className="aspect-square bg-[var(--color-surface-3)] flex items-center justify-center">
                      {isImage ? (
                        mat.thumbnailUrl ? (
                          <img src={mat.thumbnailUrl} alt={mat.filename} className="w-full h-full object-cover" />
                        ) : (
                          <Image size={20} className="text-[var(--color-text-secondary)]" />
                        )
                      ) : (
                        <Film size={20} className="text-[var(--color-text-secondary)]" />
                      )}
                    </div>
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-md bg-[var(--color-brand)] flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeMaterial(mat.id); }}
                      className="absolute top-1 left-1 w-5 h-5 rounded-md bg-[var(--color-surface)] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ boxShadow: 'var(--shadow-sm)' }}
                    >
                      <Trash2 size={10} className="text-[var(--color-error)]" />
                    </button>
                    {/* Filename */}
                    <p className="text-[9px] text-[var(--color-text-muted)] text-center truncate px-1 py-0.5 bg-[var(--color-surface-2)]">
                      {mat.filename}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
