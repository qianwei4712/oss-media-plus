import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ChevronRight,
  ExternalLink,
  Folder,
  Maximize2,
  Pause,
  Play,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { listDirectory, moveObject, moveObjectToRecovery, normalizeDir, normalizeRoot, restoreObject, signObjectUrl } from '../oss';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAppStore } from '../store';
import type { FolderItem, MediaItem } from '../types';

interface PlayerPanelProps {
  item: MediaItem | null;
  onMoved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value)) return '00:00';
  const total = Math.floor(value);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (total % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export function PlayerPanel({ item, onMoved, onDeleted }: PlayerPanelProps) {
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLAudioElement & HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [restoring, setRestoring] = useState(false);
  const [restoreHint, setRestoreHint] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [targetDir, setTargetDir] = useState('');
  const [pickerDir, setPickerDir] = useState('');
  const [pickerFolders, setPickerFolders] = useState<FolderItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const config = useAppStore((state) => state.config);
  const currentDir = useAppStore((state) => state.currentDir);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const patchItem = useAppStore((state) => state.patchItem);
  const setError = useAppStore((state) => state.setError);
  const needsRestore = Boolean(
    item?.storageClass && ['Archive', 'ColdArchive', 'DeepColdArchive'].includes(item.storageClass),
  );

  const pickerCrumbs = useMemo(() => {
    const parts = pickerDir.split('/').filter(Boolean);
    const result: Array<{ label: string; path: string }> = [{ label: '根目录', path: '' }];
    parts.forEach((part, index) => {
      const path = `${parts.slice(0, index + 1).join('/')}/`;
      result.push({ label: part, path });
    });
    return result;
  }, [pickerDir]);

  const loadPickerFolders = async (dir: string) => {
    if (!config) return;
    setPickerLoading(true);
    try {
      const result = await listDirectory(config, dir);
      setPickerFolders(result.folders);
    } finally {
      setPickerLoading(false);
    }
  };

  useEffect(() => {
    const element = mediaRef.current;
    if (element) {
      element.pause();
      element.currentTime = 0;
      element.load();
    }
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setRestoring(false);
    setRestoreHint('');
    setMoveOpen(false);
    setDeleting(false);
    setTargetDir('');
    setPickerDir('');
    setPickerFolders([]);
  }, [item?.path]);

  useEffect(() => {
    if (!item || typeof window === 'undefined') return;
    if (window.innerWidth > 1100) return;

    panelRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [item?.path]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === previewRef.current);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const element = mediaRef.current;
    if (!element) return;

    const onTime = () => setCurrentTime(element.currentTime);
    const onLoaded = () => setDuration(element.duration || 0);
    const onEnded = () => setIsPlaying(false);

    element.volume = volume;
    element.addEventListener('timeupdate', onTime);
    element.addEventListener('loadedmetadata', onLoaded);
    element.addEventListener('ended', onEnded);

    return () => {
      element.removeEventListener('timeupdate', onTime);
      element.removeEventListener('loadedmetadata', onLoaded);
      element.removeEventListener('ended', onEnded);
    };
  }, [volume, item?.path]);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min((currentTime / duration) * 100, 100);
  }, [currentTime, duration]);

  const togglePlay = async () => {
    const element = mediaRef.current;
    if (!element) return;

    if (element.paused) {
      try {
        await element.play();
        setIsPlaying(true);
        setError('');
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误';
        setError(`播放失败：${message}`);
      }
      return;
    }

    element.pause();
    setIsPlaying(false);
  };

  const seek = (next: number) => {
    const element = mediaRef.current;
    if (!element || !duration) return;
    const time = (next / 100) * duration;
    element.currentTime = time;
    setCurrentTime(time);
  };

  const refreshSignedUrl = () => {
    if (!config || !item) return;
    patchItem(item.path, { url: signObjectUrl(config, item.path) });
    setError('');
  };

  const openInNewWindow = () => {
    if (!item) return;
    const opened = window.open(item.url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      setError('新窗口被浏览器拦截，请允许弹窗后重试。');
      return;
    }
    setError('');
  };

  const enterFullscreen = async () => {
    const element = previewRef.current;
    if (!element) return;

    if (!document.fullscreenEnabled) {
      setError('当前浏览器不支持全屏查看。');
      return;
    }

    try {
      await element.requestFullscreen();
      setError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`进入全屏失败：${message}`);
    }
  };

  const submitRestore = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }
    if (!item || !needsRestore) return;

    setRestoring(true);
    setRestoreHint('');
    setError('');
    try {
      const result = await restoreObject(config, item.path, item.storageClass);
      const status = (result as { res?: { status?: number } })?.res?.status;
      if (status === 200) {
        setRestoreHint('对象已处于可读状态，可以直接重试预览或播放。');
      } else {
        setRestoreHint('已发起解冻，请稍后重试预览或播放。');
      }
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        setRestoreHint('对象正在解冻中，请稍后重试预览或播放。');
      } else {
        const message = error instanceof Error ? error.message : '未知错误';
        setError(`解冻失败：${message}`);
      }
    } finally {
      setRestoring(false);
    }
  };

  const openMove = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }

    setError('');
    setMoveOpen(true);
    setTargetDir(currentDir);
    setPickerDir(currentDir);
    try {
      await loadPickerFolders(currentDir);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`读取目录失败：${message}`);
    }
  };

  const enterPickerDir = async (dir: string) => {
    if (!config) return;
    const normalized = normalizeDir(dir);
    setPickerDir(normalized);
    setTargetDir(normalized);
    setError('');
    try {
      await loadPickerFolders(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`读取目录失败：${message}`);
    }
  };

  const submitMove = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }
    if (!item) return;

    setMoving(true);
    setError('');
    try {
      const prefix = normalizeRoot(config.rootPath);
      const toKey = `${prefix}${normalizeDir(targetDir)}${item.name}`;
      await moveObject(config, item.path, toKey);
      setMoveOpen(false);
      setCurrent(null);
      await onMoved();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`移动失败：${message}`);
    } finally {
      setMoving(false);
    }
  };

  const submitDelete = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }
    if (!item) return;
    if (!window.confirm(`确认将 "${item.name}" 移动到回收站吗？`)) {
      return;
    }

    setDeleting(true);
    setError('');
    try {
      await moveObjectToRecovery(config, item.path);
      setCurrent(null);
      await onDeleted();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`删除失败：${message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (!item) {
    return (
      <section ref={panelRef} className="panel player-panel empty-player">
        <h2>预览面板</h2>
        <p>从左侧选择图片、音频或视频后，这里会显示预览与操作控制。</p>
      </section>
    );
  }

  return (
    <section ref={panelRef} className="panel player-panel">
      <div className="section-head">
        <div className="section-title">
          <h2>预览与操作</h2>
        </div>
      </div>

      <div className="player-header">
        <strong>{item.name}</strong>
        <span>{item.path}</span>
      </div>

      {needsRestore ? (
        <div className="restore-card">
          <strong>对象存储类型为 {item.storageClass}，需要先解冻后才能访问。</strong>
          <div className="restore-actions">
            <button type="button" className="button primary" onClick={() => void submitRestore()} disabled={restoring}>
              {restoring ? '解冻中...' : '发起解冻'}
            </button>
            <button type="button" className="button secondary" onClick={refreshSignedUrl} disabled={restoring}>
              刷新链接
            </button>
          </div>
          {restoreHint ? <div className="restore-hint">{restoreHint}</div> : null}
        </div>
      ) : null}

      {item.kind === 'image' ? (
        <div ref={previewRef} className="preview-frame image-preview">
          <img
            src={item.url}
            alt={item.name}
            onError={() => setError(needsRestore ? '图片加载失败：对象可能仍未解冻。' : '图片加载失败。')}
          />
        </div>
      ) : null}

      <div className={isMobile ? 'player-actions mobile-sticky-actions mobile-media-actions' : 'player-actions'}>
        {item.kind === 'image' || item.kind === 'video' ? (
          <>
            <button
              type="button"
              className="button secondary"
              onClick={() => void enterFullscreen()}
              aria-label="全屏查看"
              title="全屏查看"
            >
              <Maximize2 size={16} />
              <span className="player-action-label">全屏查看</span>
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={openInNewWindow}
              aria-label="新窗口打开"
              title="新窗口打开"
            >
              <ExternalLink size={16} />
              <span className="player-action-label">新窗口打开</span>
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="button secondary"
          onClick={openMove}
          disabled={!config || moving}
          aria-label="移动到"
          title="移动到"
        >
          <ArrowRightLeft size={16} />
          <span className="player-action-label">移动到...</span>
        </button>
        <button
          type="button"
          className="button danger"
          onClick={() => void submitDelete()}
          disabled={!config || moving || deleting}
          aria-label={deleting ? '删除中' : '删除到回收站'}
          title={deleting ? '删除中' : '删除到回收站'}
        >
          <Trash2 size={16} />
          <span className="player-action-label">{deleting ? '删除中...' : '删除到回收站'}</span>
        </button>
      </div>

      {moveOpen ? (
        <div className="move-dialog">
          <div className="move-dialog-header">
            <strong>移动文件</strong>
            <button type="button" className="icon-button" onClick={() => setMoveOpen(false)} disabled={moving}>
              <X size={16} />
            </button>
          </div>
          <div className="move-dialog-section">
            <div className="move-dialog-title">
              <Folder size={16} />
              <span>选择目标目录</span>
            </div>
            <div className="breadcrumbs breadcrumbs-compact">
              {pickerCrumbs.map((crumb, index) => (
                <div key={crumb.path || 'root'} className="breadcrumb-item">
                  <button
                    type="button"
                    className="breadcrumb-link"
                    onClick={() => void enterPickerDir(crumb.path)}
                    disabled={moving || pickerLoading || crumb.path === pickerDir}
                  >
                    {crumb.label}
                  </button>
                  {index < pickerCrumbs.length - 1 ? <ChevronRight size={14} className="breadcrumb-sep" /> : null}
                </div>
              ))}
            </div>
            <div className="folder-grid folder-grid-compact">
              {pickerLoading ? (
                <div className="empty-state empty-state-sm">正在加载目录...</div>
              ) : pickerFolders.length ? (
                pickerFolders.map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    className="folder-card"
                    onClick={() => void enterPickerDir(folder.path)}
                    disabled={moving}
                  >
                    <Folder size={18} />
                    <span>{folder.name}</span>
                  </button>
                ))
              ) : (
                <div className="empty-state empty-state-sm">当前目录下没有子文件夹。</div>
              )}
            </div>
            <div className="move-target-preview">
              <span>已选择：</span>
              <strong>{targetDir ? `/${targetDir}` : '/'}</strong>
            </div>
          </div>
          <div className="move-dialog-actions">
            <button type="button" className="button secondary" onClick={() => setMoveOpen(false)} disabled={moving}>
              取消
            </button>
            <button type="button" className="button primary" onClick={() => void submitMove()} disabled={moving}>
              {moving ? '移动中...' : '移动'}
            </button>
          </div>
        </div>
      ) : null}

      {item.kind === 'audio' ? (
        <div className="audio-shell">
          <audio
            ref={mediaRef}
            src={item.url}
            preload="metadata"
            onError={() => setError(needsRestore ? '音频加载失败：对象可能仍未解冻。' : '音频加载失败。')}
          />
          <div className="audio-art">AUDIO</div>
        </div>
      ) : null}

      {item.kind === 'video' ? (
        <div ref={previewRef} className="preview-frame video-shell">
          <video
            ref={mediaRef}
            src={item.url}
            preload="metadata"
            playsInline
            controls={isFullscreen}
            onError={() => setError(needsRestore ? '视频加载失败：对象可能仍未解冻。' : '视频加载失败。')}
          />
        </div>
      ) : null}

      {item.kind !== 'image' ? (
        <div className="player-controls">
          <div className="transport-row">
            <button type="button" className="icon-button" onClick={() => void togglePlay()}>
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div className="timeline">
              <span>{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                value={progress}
                onChange={(event) => seek(Number(event.target.value))}
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div className="volume-row">
            <Volume2 size={16} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </div>
        </div>
      ) : null}
      {isMobile ? <div className="mobile-action-spacer" aria-hidden="true" /> : null}
    </section>
  );
}
