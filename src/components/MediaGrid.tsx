import { FileAudio, FileImage, Film, FolderSearch, LoaderCircle, Search, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import type { MediaItem, MediaKind, MediaSort } from '../types';

interface MediaGridProps {
  items: MediaItem[];
  activeKind: MediaKind | 'all';
  onKindChange: (kind: MediaKind | 'all') => void;
  onSelect: (item: MediaItem) => void;
  selectedPath?: string;
  searchQuery: string;
  searchSort: MediaSort;
  onSearchQueryChange: (query: string) => void;
  onSearchSortChange: (sort: MediaSort) => void;
  onLoadMore: () => void;
  searchHasMore: boolean;
  isSearchMode: boolean;
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
  searchQuery,
  searchSort,
  onSearchQueryChange,
  onSearchSortChange,
  onLoadMore,
  searchHasMore,
  isSearchMode,
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
      <div className="section-head">
        <div className="section-title">
          <FolderSearch size={18} />
          <h2>媒体列表</h2>
        </div>
        <p className="section-desc">支持全局搜索、类型筛选和分页加载，点击卡片即可在右侧预览。</p>
      </div>

      <div className="library-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="搜索整个媒体根目录中的文件名"
          />
        </label>
        <label className="sort-field">
          <span>排序</span>
          <select
            value={searchSort}
            onChange={(event) => onSearchSortChange(event.target.value as MediaSort)}
            disabled={!isSearchMode}
          >
            <option value="name-asc">名称升序</option>
            <option value="name-desc">名称降序</option>
          </select>
        </label>
      </div>

      {isSearchMode ? <p className="section-note">当前正在搜索整个媒体根目录，切换目录不会改变搜索范围。</p> : null}

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
        <div className="empty-state">
          {isSearchMode ? '没有匹配当前搜索条件的媒体文件。' : '当前目录下没有符合筛选条件的媒体文件。'}
        </div>
      ) : null}

      {isSearchMode && searchHasMore ? (
        <div className="load-more-row">
          <button type="button" className="button secondary" onClick={onLoadMore}>
            加载更多
          </button>
        </div>
      ) : null}
    </section>
  );
}
