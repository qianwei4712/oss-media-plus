import { LoaderCircle, RefreshCcw, TriangleAlert } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAppStore } from '../store';

export interface AppLayoutContext {
  loadMedia: () => Promise<void>;
}

interface AppLayoutProps {
  loadMedia: () => Promise<void>;
}

export function AppLayout({ loadMedia }: AppLayoutProps) {
  const config = useAppStore((state) => state.config);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <strong>OSS Media Plus</strong>
            <span>阿里云 OSS 媒体工作台</span>
          </div>
          <nav className="nav">
            <NavLink to="/library" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              媒体库
            </NavLink>
            <NavLink to="/upload" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              上传
            </NavLink>
            <NavLink to="/stats" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              统计
            </NavLink>
            <NavLink to="/recovery" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              回收站
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              配置
            </NavLink>
          </nav>
        </div>
        <button type="button" className="button primary" onClick={() => void loadMedia()} disabled={!config || loading}>
          <RefreshCcw size={16} className={loading ? 'spin' : ''} />
          刷新媒体
        </button>
      </header>

      <div className="page-shell">
        <Outlet context={{ loadMedia } satisfies AppLayoutContext} />
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
