import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { LibraryPage } from './pages/LibraryPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { UploadPage } from './pages/UploadPage';
import { listDirectory } from './oss';
import { useAppStore } from './store';

function App() {
  const config = useAppStore((state) => state.config);
  const currentDir = useAppStore((state) => state.currentDir);
  const setFolders = useAppStore((state) => state.setFolders);
  const setItems = useAppStore((state) => state.setItems);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);

  const loadMedia = async () => {
    const nextConfig = useAppStore.getState().config;
    const nextDir = useAppStore.getState().currentDir;
    if (!nextConfig) return;

    setLoading(true);
    setError('');
    try {
      const result = await listDirectory(nextConfig, nextDir);
      setFolders(result.folders);
      setItems(result.items);
      setCurrent(result.items[0] ?? null);
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
  }, [config, currentDir]);

  return (
    <Routes>
      <Route element={<AppLayout loadMedia={loadMedia} />}>
        <Route index element={<Navigate to="/library" replace />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/recovery" element={<RecoveryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
