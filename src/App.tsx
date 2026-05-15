import { useEffect, useMemo, useState } from 'react';
import { Image, LoaderCircle, Radio, RefreshCcw, TriangleAlert, Video } from 'lucide-react';
import { ConfigPanel } from './components/ConfigPanel';
import { MediaGrid } from './components/MediaGrid';
import { PlayerPanel } from './components/PlayerPanel';
import { UploadPanel } from './components/UploadPanel';
import { listMediaObjects } from './oss';
import { useAppStore } from './store';
import type { MediaKind } from './types';

function App() {
  const config = useAppStore((state) => state.config);
  const items = useAppStore((state) => state.items);
  const current = useAppStore((state) => state.current);
  const loading = useAppStore((state) => state.loading);
  const error = useAppStore((state) => state.error);
  const setItems = useAppStore((state) => state.setItems);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const [activeKind, setActiveKind] = useState<MediaKind | 'all'>('all');

  const stats = useMemo(
    () => ({
      image: items.filter((item) => item.kind === 'image').length,
      audio: items.filter((item) => item.kind === 'audio').length,
      video: items.filter((item) => item.kind === 'video').length,
    }),
    [items],
  );

  const loadMedia = async () => {
    if (!config) return;

    setLoading(true);
    setError('');
    try {
      const nextItems = await listMediaObjects(config);
      setItems(nextItems);
      setCurrent(nextItems[0] ?? null);
      if (nextItems.length === 0) {
        setError('已连接 OSS，但当前根目录下没有找到图片、音频或视频文件。');
      }
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '未知错误';
      setError(`加载媒体失败：${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (config) {
      void loadMedia();
    }
  }, []);

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">OSS Media Plus</span>
          <h1>阿里云 OSS 图片 / 音频 / 视频工作台</h1>
          <p>
            参考 `oss-fms-plus` 的本地配置思路，聚焦媒体浏览、预览和在线播放。音视频使用自定义时间轴，可直接拖拽进度。
          </p>
        </div>
        <button type="button" className="button primary" onClick={() => void loadMedia()} disabled={!config || loading}>
          <RefreshCcw size={16} className={loading ? 'spin' : ''} />
          刷新媒体
        </button>
      </header>

      <section className="stats-row">
        <article className="stat-card">
          <Image size={18} />
          <span>图片</span>
          <strong>{stats.image}</strong>
        </article>
        <article className="stat-card">
          <Radio size={18} />
          <span>音频</span>
          <strong>{stats.audio}</strong>
        </article>
        <article className="stat-card">
          <Video size={18} />
          <span>视频</span>
          <strong>{stats.video}</strong>
        </article>
      </section>

      <main className="content-grid">
        <div className="left-column">
          <ConfigPanel onConnected={loadMedia} />
          <UploadPanel onUploaded={loadMedia} />
          <MediaGrid
            items={items}
            activeKind={activeKind}
            onKindChange={setActiveKind}
            onSelect={setCurrent}
            selectedPath={current?.path}
          />
        </div>
        <PlayerPanel item={current} />
      </main>

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

export default App;
