import { create } from 'zustand';
import type { FolderItem, MediaItem, MediaSort, OSSConfig, UploadTask } from './types';

export type ThemeMode = 'light' | 'dark';

interface AppState {
  config: OSSConfig | null;
  currentDir: string;
  uploadDir: string;
  searchQuery: string;
  searchSort: MediaSort;
  searchResults: MediaItem[];
  searchCursor: number;
  searchHasMore: boolean;
  folders: FolderItem[];
  items: MediaItem[];
  current: MediaItem | null;
  loading: boolean;
  error: string;
  uploads: UploadTask[];
  theme: ThemeMode;
  setConfig: (config: OSSConfig) => void;
  setCurrentDir: (dir: string) => void;
  setUploadDir: (dir: string) => void;
  setSearchQuery: (query: string) => void;
  setSearchSort: (sort: MediaSort) => void;
  setSearchResults: (items: MediaItem[]) => void;
  setSearchCursor: (cursor: number) => void;
  setSearchHasMore: (hasMore: boolean) => void;
  clearSearchState: () => void;
  setFolders: (folders: FolderItem[]) => void;
  setItems: (items: MediaItem[]) => void;
  setCurrent: (item: MediaItem | null) => void;
  patchItem: (path: string, patch: Partial<MediaItem>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  addUploads: (tasks: UploadTask[]) => void;
  updateUpload: (id: string, patch: Partial<UploadTask>) => void;
  clearDoneUploads: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const normalizeDir = (value: string) => {
  const cleaned = value.trim().replace(/^\/+/, '');
  if (!cleaned) return '';
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
};

const readConfig = (): OSSConfig | null => {
  try {
    const raw = localStorage.getItem('oss-media-plus-config');
    return raw ? (JSON.parse(raw) as OSSConfig) : null;
  } catch {
    return null;
  }
};

const readUploadDir = () => {
  try {
    return normalizeDir(localStorage.getItem('oss-media-plus-upload-dir') ?? '');
  } catch {
    return '';
  }
};

const readTheme = (): ThemeMode => {
  try {
    const raw = localStorage.getItem('oss-media-plus-theme');
    return raw === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

export const useAppStore = create<AppState>((set) => ({
  config: readConfig(),
  currentDir: '',
  uploadDir: readUploadDir(),
  searchQuery: '',
  searchSort: 'name-asc',
  searchResults: [],
  searchCursor: 0,
  searchHasMore: false,
  folders: [],
  items: [],
  current: null,
  loading: false,
  error: '',
  uploads: [],
  theme: readTheme(),
  setConfig: (config) => {
    localStorage.setItem('oss-media-plus-config', JSON.stringify(config));
    set({ config });
  },
  setCurrentDir: (dir) => set({ currentDir: normalizeDir(dir), current: null }),
  setUploadDir: (dir) => {
    const normalized = normalizeDir(dir);
    localStorage.setItem('oss-media-plus-upload-dir', normalized);
    set({ uploadDir: normalized });
  },
  setSearchQuery: (query) => set({ searchQuery: query.trimStart(), current: null }),
  setSearchSort: (sort) => set({ searchSort: sort, current: null }),
  setSearchResults: (items) => set({ searchResults: items }),
  setSearchCursor: (cursor) => set({ searchCursor: cursor }),
  setSearchHasMore: (hasMore) => set({ searchHasMore: hasMore }),
  clearSearchState: () =>
    set({
      searchQuery: '',
      searchResults: [],
      searchCursor: 0,
      searchHasMore: false,
      current: null,
    }),
  setFolders: (folders) => set({ folders }),
  setItems: (items) => set({ items }),
  setCurrent: (item) => set({ current: item }),
  patchItem: (path, patch) =>
    set((state) => ({
      items: state.items.map((item) => (item.path === path ? { ...item, ...patch } : item)),
      searchResults: state.searchResults.map((item) => (item.path === path ? { ...item, ...patch } : item)),
      current: state.current?.path === path ? { ...state.current, ...patch } : state.current,
    })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  addUploads: (tasks) => set((state) => ({ uploads: [...state.uploads, ...tasks] })),
  updateUpload: (id, patch) =>
    set((state) => ({
      uploads: state.uploads.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    })),
  clearDoneUploads: () =>
    set((state) => ({ uploads: state.uploads.filter((task) => task.status !== 'done' && task.status !== 'error') })),
  setTheme: (theme) => {
    localStorage.setItem('oss-media-plus-theme', theme);
    set({ theme });
  },
}));
