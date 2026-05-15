import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Maximize2, Pause, Play, RotateCcw, Trash2, Volume2 } from 'lucide-react';
import { deleteObject, restoreObject, restoreRecoveryObject, signObjectUrl } from '../oss';
import { useAppStore } from '../store';
import type { RecoveryItem } from '../types';

interface RecoveryPanelProps {
  item: RecoveryItem | null;
  onRestored: () => Promise<void>;
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

const formatDeletedAt = (value: string) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export function RecoveryPanel({ item, onRestored, onDeleted }: RecoveryPanelProps) {
  const mediaRef = useRef<HTMLAudioElement & HTMLVideoElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const config = useAppStore((state) => state.config);
  const setError = useAppStore((state) => state.setError);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [restoringSource, setRestoringSource] = useState(false);
  const [restoreHint, setRestoreHint] = useState('');
  const [restoringItem, setRestoringItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState(false);
  const needsRestore = Boolean(
    item?.storageClass && ['Archive', 'ColdArchive', 'DeepColdArchive'].includes(item.storageClass),
  );

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
    setRestoringSource(false);
    setRestoreHint('');
    setRestoringItem(false);
    setDeletingItem(false);
    setMediaUrl(item?.url ?? '');
  }, [item?.recoveryObjectKey]);

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
  }, [volume, item?.recoveryObjectKey]);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min((currentTime / duration) * 100, 100);
  }, [currentTime, duration]);

  const refreshSignedUrl = () => {
    if (!config || !item) return;
    setMediaUrl(signObjectUrl(config, item.recoveryObjectKey));
    setError('');
  };

  const openInNewWindow = () => {
    if (!item) return;
    const opened = window.open(mediaUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      setError('新窗口被浏览器拦截，请允许弹出窗口后重试。');
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

  const submitRestoreSource = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }
    if (!item || !needsRestore) return;

    setRestoringSource(true);
    setRestoreHint('');
    setError('');
    try {
      const result = await restoreObject(config, item.recoveryObjectKey, item.storageClass);
      const status = (result as any)?.res?.status;
      if (status === 200) {
        setRestoreHint('对象已处于可读状态，可直接重试预览或播放。');
      } else {
        setRestoreHint('已发起解冻，请稍后重试预览或播放。');
      }
    } catch (error) {
      const status = (error as any)?.status;
      if (status === 409) {
        setRestoreHint('对象正在解冻中，请稍后重试预览或播放。');
      } else {
        const message = error instanceof Error ? error.message : '未知错误';
        setError(`解冻失败：${message}`);
      }
    } finally {
      setRestoringSource(false);
    }
  };

  const submitRestoreItem = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }
    if (!item) return;
    if (!window.confirm(`确认将 "${item.name}" 恢复到原位置吗？`)) {
      return;
    }

    setRestoringItem(true);
    setError('');
    try {
      await restoreRecoveryObject(config, item.recoveryObjectKey);
      await onRestored();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`恢复失败：${message}`);
    } finally {
      setRestoringItem(false);
    }
  };

  const submitPermanentDelete = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }
    if (!item) return;
    if (!window.confirm(`确认彻底删除 "${item.name}" 吗？此操作不可恢复。`)) {
      return;
    }

    setDeletingItem(true);
    setError('');
    try {
      await deleteObject(config, item.recoveryObjectKey);
      await onDeleted();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`彻底删除失败：${message}`);
    } finally {
      setDeletingItem(false);
    }
  };

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

  if (!item) {
    return (
      <section className="panel player-panel empty-player">
        <h2>回收站预览</h2>
        <p>从左侧选择一个已删除的媒体文件，这里会显示预览和恢复操作。</p>
      </section>
    );
  }

  return (
    <section className="panel player-panel">
      <div className="section-title">
        <h2>回收站预览</h2>
      </div>
      <div className="player-header">
        <strong>{item.name}</strong>
        <span>原路径：{item.originalPath}</span>
        <span>删除时间：{formatDeletedAt(item.deletedAt)}</span>
      </div>
      {needsRestore ? (
        <div className="restore-card">
          <strong>对象存储类型为 {item.storageClass}，需要解冻后才能访问</strong>
          <div className="restore-actions">
            <button type="button" className="button primary" onClick={() => void submitRestoreSource()} disabled={restoringSource}>
              {restoringSource ? '解冻中...' : '发起解冻'}
            </button>
            <button type="button" className="button secondary" onClick={refreshSignedUrl} disabled={restoringSource}>
              刷新链接
            </button>
          </div>
          {restoreHint ? <div className="restore-hint">{restoreHint}</div> : null}
        </div>
      ) : null}
      {item.kind === 'image' ? (
        <div ref={previewRef} className="preview-frame image-preview">
          <img
            src={mediaUrl}
            alt={item.name}
            onError={() => setError(needsRestore ? '图片加载失败：对象可能仍未解冻。' : '图片加载失败。')}
          />
        </div>
      ) : null}
      <div className="player-actions">
        {(item.kind === 'image' || item.kind === 'video') ? (
          <>
            <button type="button" className="button secondary" onClick={() => void enterFullscreen()}>
              <Maximize2 size={16} />
              全屏查看
            </button>
            <button type="button" className="button secondary" onClick={openInNewWindow}>
              <ExternalLink size={16} />
              新窗口打开
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="button primary"
          onClick={() => void submitRestoreItem()}
          disabled={restoringItem || deletingItem}
        >
          <RotateCcw size={16} />
          {restoringItem ? '恢复中...' : '恢复到原位置'}
        </button>
        <button
          type="button"
          className="button danger"
          onClick={() => void submitPermanentDelete()}
          disabled={restoringItem || deletingItem}
        >
          <Trash2 size={16} />
          {deletingItem ? '删除中...' : '彻底删除'}
        </button>
      </div>
      {item.kind === 'audio' ? (
        <div className="audio-shell">
          <audio
            ref={mediaRef}
            src={mediaUrl}
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
            src={mediaUrl}
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
    </section>
  );
}
