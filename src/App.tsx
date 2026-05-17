import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { invalidateMediaListCache, listDirectory, searchMediaObjects } from './oss';
import { LibraryPage } from './pages/LibraryPage';
import { RecoveryPage } from './pages/RecoveryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { UploadPage } from './pages/UploadPage';
import { useAppStore } from './store';

const SEARCH_PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;

function App() {
  const config = useAppStore((state) => state.config);
  const currentDir = useAppStore((state) => state.currentDir);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const searchSort = useAppStore((state) => state.searchSort);
  const searchResults = useAppStore((state) => state.searchResults);
  const searchCursor = useAppStore((state) => state.searchCursor);
  const searchHasMore = useAppStore((state) => state.searchHasMore);
  const setFolders = useAppStore((state) => state.setFolders);
  const setItems = useAppStore((state) => state.setItems);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const setLoading = useAppStore((state) => state.setLoading);
  const setError = useAppStore((state) => state.setError);
  const setSearchResults = useAppStore((state) => state.setSearchResults);
  const setSearchCursor = useAppStore((state) => state.setSearchCursor);
  const setSearchHasMore = useAppStore((state) => state.setSearchHasMore);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const latestRequestIdRef = useRef(0);

  const loadDirectoryState = async (
    nextConfig: NonNullable<typeof config>,
    nextDir: string,
    requestId: number,
    preserveSearchResults = true,
  ) => {
    const directoryResult = await listDirectory(nextConfig, nextDir);
    if (requestId !== latestRequestIdRef.current) return;
    setFolders(directoryResult.folders);

    if (!preserveSearchResults) {
      setItems(directoryResult.items);
      setCurrent(directoryResult.items[0] ?? null);
    }
  };

  const loadSearchState = async (
    nextConfig: NonNullable<typeof config>,
    nextSearchQuery: string,
    nextSearchSort: typeof searchSort,
    requestId: number,
  ) => {
    const previousCurrentPath = useAppStore.getState().current?.path;
    const result = await searchMediaObjects(nextConfig, {
      query: nextSearchQuery,
      sort: nextSearchSort,
    });
    if (requestId !== latestRequestIdRef.current) return;
    const initialItems = result.slice(0, SEARCH_PAGE_SIZE);
    setSearchResults(result);
    setSearchCursor(initialItems.length);
    setSearchHasMore(result.length > initialItems.length);
    setItems(initialItems);
    setCurrent(initialItems.find((nextItem) => nextItem.path === previousCurrentPath) ?? initialItems[0] ?? null);
  };

  const runLoadCycle = async (options?: { forceRefresh?: boolean }) => {
    const nextConfig = useAppStore.getState().config;
    const nextDir = useAppStore.getState().currentDir;
    const nextSearchQuery = useAppStore.getState().searchQuery.trim();
    const nextSearchSort = useAppStore.getState().searchSort;
    if (!nextConfig) return;

    const requestId = ++latestRequestIdRef.current;
    if (options?.forceRefresh) {
      invalidateMediaListCache(nextConfig);
    }

    setLoading(true);
    setError('');
    try {
      if (nextSearchQuery) {
        await loadDirectoryState(nextConfig, nextDir, requestId, true);
        await loadSearchState(nextConfig, nextSearchQuery, nextSearchSort, requestId);
      } else {
        setSearchResults([]);
        setSearchCursor(0);
        setSearchHasMore(false);
        await loadDirectoryState(nextConfig, nextDir, requestId, false);
      }
    } catch (loadError) {
      if (requestId !== latestRequestIdRef.current) return;
      const message = loadError instanceof Error ? loadError.message : '鏈煡閿欒';
      setError(`鍔犺浇濯掍綋澶辫触锛?{message}`);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const loadMedia = async () => {
    await runLoadCycle({ forceRefresh: true });
  };

  const loadMoreMedia = () => {
    const nextSearchQuery = debouncedSearchQuery.trim();
    if (!nextSearchQuery || !searchHasMore) return;

    const nextItems = searchResults.slice(0, searchCursor + SEARCH_PAGE_SIZE);
    setItems(nextItems);
    setSearchCursor(nextItems.length);
    setSearchHasMore(searchResults.length > nextItems.length);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!config) return;
    void runLoadCycle();
  }, [config, currentDir, debouncedSearchQuery, searchSort]);

  return (
    <Routes>
      <Route element={<AppLayout loadMedia={loadMedia} loadMoreMedia={loadMoreMedia} />}>
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
