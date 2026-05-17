import {
  Archive,
  ChartColumn,
  CloudCog,
  FolderKanban,
  LoaderCircle,
  Moon,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';

export interface AppLayoutContext {
  loadMedia: () => Promise<void>;
  loadMoreMedia: () => void;
}

interface AppLayoutProps {
  loadMedia: () => Promise<void>;
  loadMoreMedia: () => void;
}

export function AppLayout({ loadMedia, loadMoreMedia }: AppLayoutProps) {
  const location = useLocation();
  const config = useAppStore((state) => state.config);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const items = useAppStore((state) => state.items);
  const folders = useAppStore((state) => state.folders);
  const uploads = useAppStore((state) => state.uploads);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const pageMeta: Record<string, { title: string; description: string }> = {
    '/library': {
      title: '媒体库',
      description: '浏览目录、搜索资源、预览并管理媒体文件。',
    },
    '/upload': {
      title: '上传中心',
      description: '选择目标目录后批量上传图片、音频和视频。',
    },
    '/stats': {
      title: '统计概览',
      description: '查看当前媒体列表的分类数量与整体规模。',
    },
    '/recovery': {
      title: '回收站',
      description: '恢复误删资源，或执行彻底删除。',
    },
    '/settings': {
      title: '连接配置',
      description: '管理 OSS 连接信息与媒体根目录设置。',
    },
  };

  const currentMeta = pageMeta[location.pathname] ?? pageMeta['/library'];
  const pendingUploads = uploads.filter((task) => task.status === 'pending' || task.status === 'uploading').length;
  const isDark = theme === 'dark';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <CloudCog size={18} />
          </div>
          <div className="brand">
            <strong>OSS Media Plus</strong>
            <span>更简洁的 OSS 媒体工作台</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/library" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            <FolderKanban size={18} />
            媒体库
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            <Upload size={18} />
            上传
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            <ChartColumn size={18} />
            统计
          </NavLink>
          <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            <Archive size={18} />
            回收站
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            <Settings2 size={18} />
            配置
          </NavLink>
        </nav>

        <div className="sidebar-card">
          <div className="sidebar-card-title">
            <ShieldCheck size={16} />
            <span>连接状态</span>
          </div>
          <strong>{config ? '已连接配置' : '未配置 OSS'}</strong>
          <small>{config ? `${config.bucket} · ${config.region}` : '请先在配置页完成连接测试'}</small>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-copy">
            <h1>{currentMeta.title}</h1>
            <p>{currentMeta.description}</p>
          </div>

          <div className="topbar-actions">
            <div className="topbar-stats">
              <div className="topbar-stat">
                <span>目录</span>
                <strong>{folders.length}</strong>
              </div>
              <div className="topbar-stat">
                <span>文件</span>
                <strong>{items.length}</strong>
              </div>
              <div className="topbar-stat">
                <span>上传队列</span>
                <strong>{pendingUploads}</strong>
              </div>
            </div>

            <button
              type="button"
              className="button secondary theme-toggle"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              aria-label={isDark ? '切换到浅色模式' : '切换到暗黑模式'}
              title={isDark ? '切换到浅色模式' : '切换到暗黑模式'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
              <span className="theme-toggle-label">{isDark ? '浅色' : '暗黑'}</span>
            </button>

            <button type="button" className="button primary" onClick={() => void loadMedia()} disabled={!config || loading}>
              <RefreshCcw size={16} className={loading ? 'spin' : ''} />
              刷新列表
            </button>
          </div>
        </header>

        <div className="page-shell">
          <Outlet context={{ loadMedia, loadMoreMedia } satisfies AppLayoutContext} />
        </div>
      </div>

      {loading ? (
        <div className="status-banner info">
          <LoaderCircle size={16} className="spin" />
          正在读取 OSS 媒体列表...
        </div>
      ) : null}
      {error ? (
        <div className="status-banner warn">
          <TriangleAlert size={16} />
          {error}
        </div>
      ) : null}
    </div>
  );
}
