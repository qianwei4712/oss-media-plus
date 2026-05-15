import { FileAudio, FileImage, Film, FolderSearch, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { MediaItem, MediaKind } from '../types';

interface MediaGridProps {
  items: MediaItem[];
  activeKind: MediaKind | 'all';
  onKindChange: (kind: MediaKind | 'all') => void;
  onSelect: (item: MediaItem) => void;
  selectedPath?: string;
}

const tabs: Array<{ label: string; value: MediaKind | 'all' }> = [
  { label: '全部', value: 'all' },
  { label: '图片', value: 'image' },
  { label: '音频', value: 'audio' },
  { label: '视频', value: 'video' },
];

const iconMap = {
  image: FileImage,
  audio: FileAudio,
  video: Film,
  other: FolderSearch,
};

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export function MediaGrid({
  items,
  activeKind,
  onKindChange,
  onSelect,
  selectedPath,
}: MediaGridProps) {
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [imageLoading, setImageLoading] = useState<Set<string>>(new Set());
  const filtered = activeKind === 'all' ? items : items.filter((item) => item.kind === activeKind);

  const handleImageError = (path: string) => {
    setImageErrors((prev) => new Set(prev).add(path));
  };

  const handleImageLoad = (path: string) => {
    setImageLoading((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  return (
    <section className="panel">
      <div className="section-title">
        <FolderSearch size={18} />
        <h2>媒体列表</h2>
      </div>
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={tab.value === activeKind ? 'tab active' : 'tab'}
            onClick={() => onKindChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="media-grid">
        {filtered.map((item) => {
          const Icon = iconMap[item.kind];
          const hasImageError = imageErrors.has(item.path);
          const isLoading = imageLoading.has(item.path);

          return (
            <button
              key={item.path}
              type="button"
              className={item.path === selectedPath ? 'media-card selected' : 'media-card'}
              onClick={() => onSelect(item)}
            >
              <div className="media-thumb">
                {item.kind === 'image' ? (
                  <div className="image-container">
                    {isLoading ? (
                      <div className="image-placeholder">
                        <LoaderCircle size={24} className="spin" />
                      </div>
                    ) : hasImageError ? (
                      <div className="image-error">
                        <TriangleAlert size={24} />
                      </div>
                    ) : (
                      <img
                        src={item.url}
                        alt={item.name}
                        loading="lazy"
                        onError={() => handleImageError(item.path)}
                        onLoad={() => handleImageLoad(item.path)}
                      />
                    )}
                  </div>
                ) : (
                  <Icon size={28} />
                )}
              </div>
              <div className="media-meta">
                <strong>{item.name}</strong>
                <span>{item.path}</span>
                <small>
                  {item.kind.toUpperCase()} · {formatSize(item.size)}
                  {item.storageClass && item.storageClass !== 'Standard' ? ` · ${item.storageClass}` : ''}
                </small>
              </div>
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">当前目录下没有符合筛选条件的媒体文件。</div>
      ) : null}
    </section>
  );
}
