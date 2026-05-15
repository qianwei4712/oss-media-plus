import { ChevronRight, Folder, FolderPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MediaGrid } from '../components/MediaGrid';
import { PlayerPanel } from '../components/PlayerPanel';
import { useAppStore } from '../store';
import { createFolder } from '../oss';
import type { AppLayoutContext } from '../layouts/AppLayout';
import type { MediaKind } from '../types';

export function LibraryPage() {
  const { loadMedia } = useOutletContext<AppLayoutContext>();
  const config = useAppStore((state) => state.config);
  const items = useAppStore((state) => state.items);
  const folders = useAppStore((state) => state.folders);
  const current = useAppStore((state) => state.current);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const currentDir = useAppStore((state) => state.currentDir);
  const setCurrentDir = useAppStore((state) => state.setCurrentDir);
  const setError = useAppStore((state) => state.setError);
  const [activeKind, setActiveKind] = useState<MediaKind | 'all'>('all');
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState('');

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

  return (
    <main className="content-grid">
      <div className="left-column">
        <section className="panel">
          <div className="section-title">
            <Folder size={18} />
            <h2>目录</h2>
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
                  onClick={() => setCurrentDir(folder.path)}
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
              placeholder="新建文件夹名称"
              disabled={creating}
            />
            <button type="button" className="button secondary" onClick={() => void handleCreateFolder()} disabled={creating}>
              <FolderPlus size={16} />
              创建
            </button>
          </div>
        </section>
        <MediaGrid
          items={items}
          activeKind={activeKind}
          onKindChange={setActiveKind}
          onSelect={setCurrent}
          selectedPath={current?.path}
        />
      </div>
      <PlayerPanel item={current} onMoved={loadMedia} onDeleted={loadMedia} />
    </main>
  );
}
