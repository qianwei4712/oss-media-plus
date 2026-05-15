import { create } from 'zustand';
import type { MediaItem, OSSConfig, UploadTask } from './types';

interface AppState {
  config: OSSConfig | null;
  items: MediaItem[];
  current: MediaItem | null;
  loading: boolean;
  error: string;
  uploads: UploadTask[];
  setConfig: (config: OSSConfig) => void;
  setItems: (items: MediaItem[]) => void;
  setCurrent: (item: MediaItem | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  addUploads: (tasks: UploadTask[]) => void;
  updateUpload: (id: string, patch: Partial<UploadTask>) => void;
  clearDoneUploads: () => void;
}

const readConfig = (): OSSConfig | null => {
  try {
    const raw = localStorage.getItem('oss-media-plus-config');
    return raw ? (JSON.parse(raw) as OSSConfig) : null;
  } catch {
    return null;
  }
};

export const useAppStore = create<AppState>((set) => ({
  config: readConfig(),
  items: [],
  current: null,
  loading: false,
  error: '',
  uploads: [],
  setConfig: (config) => {
    localStorage.setItem('oss-media-plus-config', JSON.stringify(config));
    set({ config });
  },
  setItems: (items) => set({ items }),
  setCurrent: (item) => set({ current: item }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  addUploads: (tasks) => set((state) => ({ uploads: [...state.uploads, ...tasks] })),
  updateUpload: (id, patch) =>
    set((state) => ({
      uploads: state.uploads.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  clearDoneUploads: () =>
    set((state) => ({ uploads: state.uploads.filter((t) => t.status !== 'done' && t.status !== 'error') })),
}));
