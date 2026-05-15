import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Volume2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { MediaItem } from '../types';

interface PlayerPanelProps {
  item: MediaItem | null;
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

export function PlayerPanel({ item }: PlayerPanelProps) {
  const mediaRef = useRef<HTMLAudioElement & HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const setError = useAppStore((state) => state.setError);

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
