import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, ChevronRight, Folder, Pause, Play, Volume2, X } from 'lucide-react';
import { listDirectory, moveObject, normalizeDir, normalizeRoot } from '../oss';
import { useAppStore } from '../store';
import type { FolderItem, MediaItem } from '../types';

interface PlayerPanelProps {
  item: MediaItem | null;
  onMoved: () => Promise<void>;
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

export function PlayerPanel({ item, onMoved }: PlayerPanelProps) {
  const mediaRef = useRef<HTMLAudioElement & HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [targetDir, setTargetDir] = useState('');
  const [pickerDir, setPickerDir] = useState('');
  const [pickerFolders, setPickerFolders] = useState<FolderItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const config = useAppStore((state) => state.config);
  const currentDir = useAppStore((state) => state.currentDir);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const setError = useAppStore((state) => state.setError);

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
    setMoveOpen(false);
    setTargetDir('');
    setPickerDir('');
    setPickerFolders([]);
  }, [item?.path]);

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
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
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

  if (!item) {
    return (
      <section className="panel player-panel empty-player">
        <h2>播放器</h2>
        <p>从左侧选择图片、音频或视频后，这里会显示预览和播放控制。</p>
      </section>
    );
  }

  return (
    <section className="panel player-panel">
      <div className="section-title">
        <h2>预览与播放</h2>
      </div>
      <div className="player-header">
        <strong>{item.name}</strong>
        <span>{item.path}</span>
      </div>
      {item.kind === 'image' ? (
        <div className="image-preview">
          <img src={item.url} alt={item.name} />
        </div>
      ) : null}
      <div className="player-actions">
        <button type="button" className="button secondary" onClick={openMove} disabled={!config || moving}>
          <ArrowRightLeft size={16} />
          移动到...
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
          <audio ref={mediaRef} src={item.url} preload="metadata" />
          <div className="audio-art">AUDIO</div>
        </div>
      ) : null}
      {item.kind === 'video' ? (
        <div className="video-shell">
          <video ref={mediaRef} src={item.url} preload="metadata" playsInline />
        </div>
      ) : null}
      {item.kind !== 'image' ? (
        <div className="player-controls">
          <div className="transport-row">
            <button type="button" className="icon-button" onClick={togglePlay}>
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
    </section>
  );
}
