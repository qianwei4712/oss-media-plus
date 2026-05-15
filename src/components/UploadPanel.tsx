import { useCallback, useRef, useState } from 'react';
import { CloudUpload, FileUp, Trash2, X } from 'lucide-react';
import { uploadFile, normalizeDir, normalizeRoot } from '../oss';
import { useAppStore } from '../store';
import type { UploadTask } from '../types';

const mediaExt = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif',
  'mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac',
  'mp4', 'webm', 'mov', 'm3u8', 'mkv',
];

const isMediaFile = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return mediaExt.includes(ext);
};

const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

interface UploadPanelProps {
  onUploaded: () => Promise<void>;
}

export function UploadPanel({ onUploaded }: UploadPanelProps) {
  const config = useAppStore((s) => s.config);
  const currentDir = useAppStore((s) => s.currentDir);
  const uploads = useAppStore((s) => s.uploads);
  const addUploads = useAppStore((s) => s.addUploads);
  const updateUpload = useAppStore((s) => s.updateUpload);
  const clearDoneUploads = useAppStore((s) => s.clearDoneUploads);
  const setError = useAppStore((s) => s.setError);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList) => {
      if (!config) {
        setError('请先配置 OSS 连接。');
        return;
      }

      const prefix = `${normalizeRoot(config.rootPath)}${normalizeDir(currentDir)}`;
      const tasks: UploadTask[] = [];

      for (const file of Array.from(files)) {
        if (!isMediaFile(file.name)) continue;
        const objectKey = `${prefix}${file.name}`;
        tasks.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          objectKey,
          status: 'pending',
          progress: 0,
        });
      }

      if (tasks.length === 0) {
        setError('所选文件中没有支持的媒体类型。');
        return;
      }

      addUploads(tasks);

      tasks.forEach((task) => {
        updateUpload(task.id, { status: 'uploading', progress: 0 });
        uploadFile(config, task.file, task.objectKey, (percent) => {
          updateUpload(task.id, { progress: percent });
        })
          .then(() => {
            updateUpload(task.id, { status: 'done', progress: 100 });
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : '上传失败';
            updateUpload(task.id, { status: 'error', error: msg });
          });
      });
    },
    [config, currentDir, addUploads, updateUpload, setError],
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const hasActive = uploads.some((t) => t.status === 'uploading');

  return (
    <section className="panel">
      <div className="section-title">
        <CloudUpload size={18} />
        <h2>上传文件</h2>
      </div>
      <p className="section-desc">
        选择或拖拽图片、音频、视频文件到下方区域，上传到：{`${normalizeRoot(config?.rootPath)}${normalizeDir(currentDir)}` || '/'}
      </p>
      <div
        className={`upload-drop-zone${dragging ? ' dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={32} />
        <span>点击选择文件或拖拽到此处</span>
        <small>支持图片、音频、视频格式</small>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*"
          style={{ display: 'none' }}
          onChange={onInputChange}
        />
      </div>

      {uploads.length > 0 ? (
        <div className="upload-list">
          {uploads.map((task) => (
            <div key={task.id} className={`upload-item upload-${task.status}`}>
              <div className="upload-item-info">
                <strong>{task.file.name}</strong>
                <small>{formatSize(task.file.size)}</small>
              </div>
              {task.status === 'uploading' ? (
                <div className="upload-progress-bar">
                  <div className="upload-progress-fill" style={{ width: `${task.progress}%` }} />
                  <span>{task.progress}%</span>
                </div>
              ) : null}
              {task.status === 'done' ? <span className="upload-badge done">完成</span> : null}
              {task.status === 'error' ? (
                <span className="upload-badge error">{task.error ?? '失败'}</span>
              ) : null}
            </div>
          ))}
          <div className="upload-actions">
            {!hasActive && uploads.some((t) => t.status === 'done') ? (
              <button type="button" className="button primary" onClick={() => void onUploaded()}>
                <CloudUpload size={16} />
                刷新媒体列表
              </button>
            ) : null}
            {!hasActive ? (
              <button type="button" className="button secondary" onClick={clearDoneUploads}>
                <Trash2 size={16} />
                清除已完成
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
