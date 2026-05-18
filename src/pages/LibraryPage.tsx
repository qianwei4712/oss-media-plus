import { ArrowLeft, ChevronRight, Folder, FolderPlus, Menu, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MediaGrid } from '../components/MediaGrid';
import { PlayerPanel } from '../components/PlayerPanel';
import { useIsMobile } from '../hooks/useIsMobile';
import type { AppLayoutContext } from '../layouts/AppLayout';
import { createFolder } from '../oss';
import { useAppStore } from '../store';
import type { MediaKind } from '../types';

export function LibraryPage() {
  const { loadMedia, loadMoreMedia } = useOutletContext<AppLayoutContext>();
  const isMobile = useIsMobile();
  const config = useAppStore((state) => state.config);
  const items = useAppStore((state) => state.items);
  const folders = useAppStore((state) => state.folders);
  const current = useAppStore((state) => state.current);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const currentDir = useAppStore((state) => state.currentDir);
  const setCurrentDir = useAppStore((state) => state.setCurrentDir);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const searchSort = useAppStore((state) => state.searchSort);
  const searchHasMore = useAppStore((state) => state.searchHasMore);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const setSearchSort = useAppStore((state) => state.setSearchSort);
  const setError = useAppStore((state) => state.setError);
  const [activeKind, setActiveKind] = useState<MediaKind | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const isSearchMode = Boolean(searchQuery.trim());

  useEffect(() => {
    if (!isMobile) return;
    const locked = Boolean(current || directoryOpen);
    if (!locked) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobile, current, directoryOpen]);

  const crumbs = useMemo(() => {
    const parts = currentDir.split('/').filter(Boolean);
    const result: Array<{ label: string; path: string }> = [{ label: '根目录', path: '' }];
    parts.forEach((part, index) => {
      const path = `${parts.slice(0, index + 1).join('/')}/`;
      result.push({ label: part, path });
    });
    return result;
  }, [currentDir]);

  const handleCreateFolder = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }

    if (!folderName.trim()) {
      setError('文件夹名称不能为空。');
      return;
    }

    setCreating(true);
    setError('');
    try {
      await createFolder(config, currentDir, folderName);
      setFolderName('');
      await loadMedia();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`新建文件夹失败：${message}`);
    } finally {
      setCreating(false);
    }
  };

  const directoryPanel = (
    <section className="panel">
      <div className="section-head">
        <div className="section-title">
          <Folder size={18} />
          <h2>目录</h2>
        </div>
        <p className="section-desc">移动端目录改成抽屉入口，避免占用首屏空间。</p>
      </div>

      <div className="breadcrumbs">
        {crumbs.map((crumb, index) => (
          <div key={crumb.path || 'root'} className="breadcrumb-item">
            <button
              type="button"
              className="breadcrumb-link"
              onClick={() => setCurrentDir(crumb.path)}
              disabled={crumb.path === currentDir}
            >
              {crumb.label}
            </button>
            {index < crumbs.length - 1 ? <ChevronRight size={14} className="breadcrumb-sep" /> : null}
          </div>
        ))}
      </div>

      <div className="folder-grid">
        {folders.length ? (
          folders.map((folder) => (
            <button
              key={folder.path}
              type="button"
              className="folder-card"
              onClick={() => {
                setCurrentDir(folder.path);
              }}
            >
              <Folder size={18} />
              <span>{folder.name}</span>
            </button>
          ))
        ) : (
          <div className="empty-state empty-state-sm">当前目录下没有子文件夹。</div>
        )}
      </div>

      <div className="folder-create-row">
        <input
          value={folderName}
          onChange={(event) => setFolderName(event.target.value)}
          placeholder="输入新文件夹名称"
          disabled={creating}
        />
        <button type="button" className="button secondary" onClick={() => void handleCreateFolder()} disabled={creating}>
          <FolderPlus size={16} />
          创建
        </button>
      </div>
    </section>
  );

  return (
    <>
      <main className="content-grid">
        <div className="left-column">
          {isMobile ? (
            <section className="panel mobile-section-summary">
              <div className="mobile-summary-row">
                <div>
                  <strong>当前目录</strong>
                  <p>{currentDir ? `/${currentDir}` : '/'}</p>
                </div>
                <button type="button" className="button secondary mobile-inline-action" onClick={() => setDirectoryOpen(true)}>
                  <Menu size={16} />
                  目录管理
                </button>
              </div>
            </section>
          ) : (
            directoryPanel
          )}

          <MediaGrid
            items={items}
            activeKind={activeKind}
            onKindChange={setActiveKind}
            onSelect={setCurrent}
            selectedPath={current?.path}
            searchQuery={searchQuery}
            searchSort={searchSort}
            onSearchQueryChange={setSearchQuery}
            onSearchSortChange={setSearchSort}
            onLoadMore={loadMoreMedia}
            searchHasMore={searchHasMore}
            isSearchMode={isSearchMode}
          />
        </div>

        {!isMobile ? <PlayerPanel item={current} onMoved={loadMedia} onDeleted={loadMedia} /> : null}
      </main>

      {isMobile && current ? (
        <div className="mobile-detail-overlay" role="dialog" aria-modal="true" aria-label="媒体预览详情">
          <div className="mobile-detail-sheet">
            <div className="mobile-detail-topbar">
              <button type="button" className="button secondary mobile-detail-back" onClick={() => setCurrent(null)}>
                <ArrowLeft size={16} />
                返回列表
              </button>
              <strong>预览详情</strong>
            </div>
            <div className="mobile-detail-body">
              <PlayerPanel item={current} onMoved={loadMedia} onDeleted={loadMedia} />
            </div>
          </div>
        </div>
      ) : null}

      {isMobile && directoryOpen ? (
        <div className="mobile-drawer-overlay" role="dialog" aria-modal="true" aria-label="目录管理">
          <div className="mobile-drawer-sheet mobile-drawer-sheet-wide">
            <div className="mobile-drawer-header">
              <strong>目录管理</strong>
              <button type="button" className="icon-button" onClick={() => setDirectoryOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="mobile-drawer-body">{directoryPanel}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
