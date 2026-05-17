import { useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  ArrowLeft,
  CheckSquare,
  FileAudio,
  FileImage,
  Film,
  FolderSearch,
  LoaderCircle,
  RotateCcw,
  Settings2,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { RecoveryPanel } from '../components/RecoveryPanel';
import { useIsMobile } from '../hooks/useIsMobile';
import type { AppLayoutContext } from '../layouts/AppLayout';
import { deleteObjects, listRecoveryItems, normalizeRecoveryDir, restoreRecoveryObjects } from '../oss';
import { useAppStore } from '../store';
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
  const isMobile = useIsMobile();
  const config = useAppStore((state) => state.config);
  const setError = useAppStore((state) => state.setError);
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [current, setCurrent] = useState<RecoveryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeKind, setActiveKind] = useState<MediaKind | 'all'>('all');
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchSummary, setBatchSummary] = useState<{ tone: 'info' | 'warn'; message: string } | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    const locked = Boolean(current || toolsOpen);
    if (!locked) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, current, toolsOpen]);

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
      setCurrent((previous) => result.find((item) => item.recoveryObjectKey === previous?.recoveryObjectKey) ?? result[0] ?? null);
      setSelectedKeys((previous) => new Set(Array.from(previous).filter((key) => result.some((item) => item.recoveryObjectKey === key))));
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

  const visibleKeys = filtered.map((item) => item.recoveryObjectKey);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));
  const selectedCount = selectedKeys.size;
  const activeTabLabel = tabs.find((tab) => tab.value === activeKind)?.label ?? '全部';

  const handleRecovered = async () => {
    await Promise.all([loadRecovery(), loadMedia()]);
  };

  const handleDeleted = async () => {
    await loadRecovery();
  };

  useEffect(() => {
    setSelectedKeys((previous) => new Set(Array.from(previous).filter((key) => visibleKeys.includes(key))));
  }, [activeKind, items]);

  const toggleSelected = (key: string) => {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedKeys(new Set(visibleKeys));
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const buildBatchMessage = (actionLabel: string, successCount: number, failureCount: number, failureReason?: string) => {
    if (failureCount === 0) {
      return {
        tone: 'info' as const,
        message: `${actionLabel}完成：成功 ${successCount} 项。`,
      };
    }

    return {
      tone: 'warn' as const,
      message: `${actionLabel}完成：成功 ${successCount} 项，失败 ${failureCount} 项。${failureReason ? ` 失败原因：${failureReason}` : ''}`,
    };
  };

  const handleBatchRestore = async () => {
    if (!config || selectedCount === 0) return;
    if (!window.confirm(`确认恢复已选中的 ${selectedCount} 个对象吗？`)) {
      return;
    }

    setBatchRunning(true);
    setBatchSummary(null);
    setError('');
    try {
      const result = await restoreRecoveryObjects(config, Array.from(selectedKeys));
      setBatchSummary(buildBatchMessage('批量恢复', result.successCount, result.failureCount, result.failures[0]?.reason));
      await Promise.all([loadRecovery(), loadMedia()]);
      setToolsOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`批量恢复失败：${message}`);
    } finally {
      setBatchRunning(false);
    }
  };

  const handleBatchDelete = async () => {
    if (!config || selectedCount === 0) return;
    if (!window.confirm(`确认彻底删除已选中的 ${selectedCount} 个对象吗？此操作不可恢复。`)) {
      return;
    }

    setBatchRunning(true);
    setBatchSummary(null);
    setError('');
    try {
      const result = await deleteObjects(config, Array.from(selectedKeys));
      setBatchSummary(buildBatchMessage('批量删除', result.successCount, result.failureCount, result.failures[0]?.reason));
      await loadRecovery();
      setToolsOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`批量删除失败：${message}`);
    } finally {
      setBatchRunning(false);
    }
  };

  const toolsPanel = (
    <>
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

      <div className="mobile-selection-note">
        <CheckSquare size={16} />
        <span>已选择 {selectedCount} 项</span>
      </div>

      <div className="mobile-tools-actions">
        <button
          type="button"
          className="button secondary"
          onClick={allVisibleSelected ? clearSelection : selectAllVisible}
          disabled={!visibleKeys.length || batchRunning}
        >
          {allVisibleSelected ? '取消全选当前结果' : '全选当前结果'}
        </button>
        <button type="button" className="button secondary" onClick={clearSelection} disabled={!selectedCount || batchRunning}>
          清空选择
        </button>
        <button type="button" className="button primary" onClick={() => void handleBatchRestore()} disabled={!selectedCount || batchRunning}>
          <RotateCcw size={16} />
          {batchRunning ? '处理中...' : '批量恢复'}
        </button>
        <button type="button" className="button danger" onClick={() => void handleBatchDelete()} disabled={!selectedCount || batchRunning}>
          <Trash2 size={16} />
          {batchRunning ? '处理中...' : '批量彻底删除'}
        </button>
      </div>
    </>
  );

  return (
    <>
      <main className="content-grid">
        <div className="left-column">
          <section className="panel">
            <div className="section-head">
              <div className="section-title">
                <ArchiveRestore size={18} />
                <h2>回收站</h2>
              </div>
              <p className="section-desc">当前路径：{normalizeRecoveryDir(config?.recoveryPath) || 'recovery/'}</p>
            </div>

            {isMobile ? (
              <div className="mobile-summary-row mobile-summary-row-stacked">
                <div>
                  <strong>当前筛选</strong>
                  <p>{activeTabLabel} · 已选 {selectedCount} 项</p>
                </div>
                <button type="button" className="button secondary mobile-inline-action" onClick={() => setToolsOpen(true)}>
                  <Settings2 size={16} />
                  批量与筛选
                </button>
              </div>
            ) : (
              <>
                <div className="batch-toolbar">
                  <div className="batch-toolbar-meta">
                    <CheckSquare size={16} />
                    <span>已选择 {selectedCount} 项</span>
                  </div>
                  <div className="batch-toolbar-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={allVisibleSelected ? clearSelection : selectAllVisible}
                      disabled={!visibleKeys.length || batchRunning}
                    >
                      {allVisibleSelected ? '取消全选当前结果' : '全选当前结果'}
                    </button>
                    <button type="button" className="button secondary" onClick={clearSelection} disabled={!selectedCount || batchRunning}>
                      清空选择
                    </button>
                    <button type="button" className="button primary" onClick={() => void handleBatchRestore()} disabled={!selectedCount || batchRunning}>
                      <RotateCcw size={16} />
                      {batchRunning ? '处理中...' : '批量恢复'}
                    </button>
                    <button type="button" className="button danger" onClick={() => void handleBatchDelete()} disabled={!selectedCount || batchRunning}>
                      <Trash2 size={16} />
                      {batchRunning ? '处理中...' : '批量彻底删除'}
                    </button>
                  </div>
                </div>

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
              </>
            )}

            {batchSummary ? <div className={`status-banner ${batchSummary.tone}`}>{batchSummary.message}</div> : null}

            <div className="media-grid">
              {filtered.map((item) => {
                const Icon = iconMap[item.kind];
                const hasImageError = imageErrors.has(item.recoveryObjectKey);

                return (
                  <div
                    key={item.recoveryObjectKey}
                    className={item.recoveryObjectKey === current?.recoveryObjectKey ? 'media-card selected selectable-card' : 'media-card selectable-card'}
                  >
                    <div className="card-state-row">
                      {item.recoveryObjectKey === current?.recoveryObjectKey ? <span className="card-state-badge">预览中</span> : <span />}
                      {selectedKeys.has(item.recoveryObjectKey) ? <span className="card-state-badge subtle">已选择</span> : null}
                    </div>
                    <label className="select-toggle" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(item.recoveryObjectKey)}
                        onChange={() => toggleSelected(item.recoveryObjectKey)}
                      />
                      <span>选择</span>
                    </label>

                    <button type="button" className="media-card-button" onClick={() => setCurrent(item)}>
                      <div className="media-thumb">
                        {item.kind === 'image' && !hasImageError ? (
                          <img
                            src={item.url}
                            alt={item.name}
                            loading="lazy"
                            onError={() =>
                              setImageErrors((previous) => {
                                const next = new Set(previous);
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
                  </div>
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

        {!isMobile ? <RecoveryPanel item={current} onRestored={handleRecovered} onDeleted={handleDeleted} /> : null}
      </main>

      {isMobile && current ? (
        <div className="mobile-detail-overlay" role="dialog" aria-modal="true" aria-label="回收站预览详情">
          <div className="mobile-detail-sheet">
            <div className="mobile-detail-topbar">
              <button type="button" className="button secondary mobile-detail-back" onClick={() => setCurrent(null)}>
                <ArrowLeft size={16} />
                返回列表
              </button>
              <strong>回收站详情</strong>
            </div>
            <div className="mobile-detail-body">
              <RecoveryPanel item={current} onRestored={handleRecovered} onDeleted={handleDeleted} />
            </div>
          </div>
        </div>
      ) : null}

      {isMobile && toolsOpen ? (
        <div className="mobile-drawer-overlay" role="dialog" aria-modal="true" aria-label="回收站筛选与批量操作">
          <div className="mobile-drawer-sheet">
            <div className="mobile-drawer-header">
              <strong>筛选与批量操作</strong>
              <button type="button" className="icon-button" onClick={() => setToolsOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="mobile-drawer-body">{toolsPanel}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
