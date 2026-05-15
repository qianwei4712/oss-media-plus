import { useEffect, useMemo, useState } from 'react';
import { ArchiveRestore, FileAudio, FileImage, Film, FolderSearch, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { RecoveryPanel } from '../components/RecoveryPanel';
import { listRecoveryItems, normalizeRecoveryDir } from '../oss';
import { useAppStore } from '../store';
import type { AppLayoutContext } from '../layouts/AppLayout';
import type { MediaKind, RecoveryItem } from '../types';

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

const formatDeletedAt = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function RecoveryPage() {
  const { loadMedia } = useOutletContext<AppLayoutContext>();
  const config = useAppStore((state) => state.config);
  const setError = useAppStore((state) => state.setError);
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [current, setCurrent] = useState<RecoveryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeKind, setActiveKind] = useState<MediaKind | 'all'>('all');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const loadRecovery = async () => {
    const nextConfig = useAppStore.getState().config;
    if (!nextConfig) {
      setItems([]);
      setCurrent(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await listRecoveryItems(nextConfig);
      setItems(result);
      setCurrent((previous) =>
        result.find((item) => item.recoveryObjectKey === previous?.recoveryObjectKey) ?? result[0] ?? null,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`加载回收站失败：${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (config) {
      void loadRecovery();
      return;
    }
    setItems([]);
    setCurrent(null);
  }, [config]);

  const filtered = useMemo(
    () => (activeKind === 'all' ? items : items.filter((item) => item.kind === activeKind)),
    [activeKind, items],
  );

  const handleRecovered = async () => {
    await Promise.all([loadRecovery(), loadMedia()]);
  };

  const handleDeleted = async () => {
    await loadRecovery();
  };

  return (
    <main className="content-grid">
      <div className="left-column">
        <section className="panel">
          <div className="section-title">
            <ArchiveRestore size={18} />
            <h2>回收站</h2>
          </div>
          <p className="section-desc">
            当前路径：{normalizeRecoveryDir(config?.recoveryPath) || 'recovery/'}
          </p>
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                className={tab.value === activeKind ? 'tab active' : 'tab'}
                onClick={() => setActiveKind(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="media-grid">
            {filtered.map((item) => {
              const Icon = iconMap[item.kind];
              const hasImageError = imageErrors.has(item.recoveryObjectKey);

              return (
                <button
                  key={item.recoveryObjectKey}
                  type="button"
                  className={item.recoveryObjectKey === current?.recoveryObjectKey ? 'media-card selected' : 'media-card'}
                  onClick={() => setCurrent(item)}
                >
                  <div className="media-thumb">
                    {item.kind === 'image' && !hasImageError ? (
                      <img
                        src={item.url}
                        alt={item.name}
                        loading="lazy"
                        onError={() =>
                          setImageErrors((prev) => {
                            const next = new Set(prev);
                            next.add(item.recoveryObjectKey);
                            return next;
                          })
                        }
                      />
                    ) : item.kind === 'image' ? (
                      <div className="image-error">
                        <TriangleAlert size={24} />
                      </div>
                    ) : (
                      <Icon size={28} />
                    )}
                  </div>
                  <div className="media-meta">
                    <strong>{item.name}</strong>
                    <span>{item.originalPath}</span>
                    <small>
                      {item.kind.toUpperCase()} · {formatSize(item.size)} · {formatDeletedAt(item.deletedAt)}
                    </small>
                  </div>
                </button>
              );
            })}
          </div>
          {loading ? (
            <div className="empty-state">
              <LoaderCircle size={20} className="spin" />
              <span>正在加载回收站...</span>
            </div>
          ) : null}
          {!loading && filtered.length === 0 ? (
            <div className="empty-state">回收站里没有符合筛选条件的媒体文件。</div>
          ) : null}
        </section>
      </div>
      <RecoveryPanel item={current} onRestored={handleRecovered} onDeleted={handleDeleted} />
    </main>
  );
}
