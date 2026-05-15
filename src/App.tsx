import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { LibraryPage } from './pages/LibraryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { UploadPage } from './pages/UploadPage';
import { listMediaObjects } from './oss';
import { useAppStore } from './store';

function App() {
  const config = useAppStore((state) => state.config);
  const setItems = useAppStore((state) => state.setItems);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);

  const loadMedia = async () => {
    const nextConfig = useAppStore.getState().config;
    if (!nextConfig) return;

    setLoading(true);
    setError('');
    try {
      const nextItems = await listMediaObjects(nextConfig);
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
  }, [config]);

  return (
    <Routes>
      <Route element={<AppLayout loadMedia={loadMedia} />}>
        <Route index element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
