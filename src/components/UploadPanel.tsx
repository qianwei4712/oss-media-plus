import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, CloudUpload, FileUp, Folder, FolderPlus, LoaderCircle, Trash2 } from 'lucide-react';
import { createFolder, detectMediaKindFromFile, listDirectory, normalizeDir, normalizeRoot, uploadFile } from '../oss';
import { useAppStore } from '../store';
import type { FolderItem, UploadTask } from '../types';

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
  const uploadDir = useAppStore((s) => s.uploadDir);
  const setUploadDir = useAppStore((s) => s.setUploadDir);
  const uploads = useAppStore((s) => s.uploads);
  const addUploads = useAppStore((s) => s.addUploads);
  const updateUpload = useAppStore((s) => s.updateUpload);
  const clearDoneUploads = useAppStore((s) => s.clearDoneUploads);
  const setError = useAppStore((s) => s.setError);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pickerDir, setPickerDir] = useState('');
  const [pickerFolders, setPickerFolders] = useState<FolderItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  const effectiveUploadDir = uploadDir || currentDir;

  const pickerCrumbs = useMemo(() => {
    const parts = pickerDir.split('/').filter(Boolean);
    const result: Array<{ label: string; path: string }> = [{ label: '根目录', path: '' }];
    parts.forEach((part, index) => {
      const path = `${parts.slice(0, index + 1).join('/')}/`;
      result.push({ label: part, path });
    });
    return result;
  }, [pickerDir]);

  const loadPickerFolders = useCallback(
    async (dir: string) => {
      if (!config) return;
      setPickerLoading(true);
      try {
        const result = await listDirectory(config, dir);
        setPickerFolders(result.folders);
      } finally {
        setPickerLoading(false);
      }
    },
    [config],
  );

  useEffect(() => {
    if (!uploadDir && currentDir) {
      setUploadDir(currentDir);
    }
  }, [currentDir, uploadDir, setUploadDir]);

  useEffect(() => {
    if (!config) return;
    const nextDir = effectiveUploadDir;
    setPickerDir(nextDir);
    void loadPickerFolders(nextDir);
  }, [config, effectiveUploadDir, loadPickerFolders]);

  const handleFiles = useCallback(
    (files: FileList) => {
      if (!config) {
        setError('请先配置 OSS 连接。');
        return;
      }

      const normalizedTargetDir = normalizeDir(effectiveUploadDir);
      const prefix = `${normalizeRoot(config.rootPath)}${normalizedTargetDir}`;
      const tasks: UploadTask[] = [];

      for (const file of Array.from(files)) {
        if (!isMediaFile(file.name)) continue;
        const objectKey = `${prefix}${file.name}`;
        tasks.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          objectKey,
          targetDir: normalizedTargetDir,
          status: 'pending',
          progress: 0,
        });
      }

      if (tasks.length === 0) {
        setError('所选文件中没有支持的媒体类型。');
        return;
      }

      addUploads(tasks);
      setError('');

      tasks.forEach((task) => {
        const kind = detectMediaKindFromFile(task.file, task.objectKey);
        const tags = {
          'omp-media': kind,
          'omp-archive': kind === 'audio' || kind === 'video' ? 'deep' : 'none',
        };
        updateUpload(task.id, { status: 'uploading', progress: 0 });
        uploadFile(config, task.file, task.objectKey, (percent) => {
          updateUpload(task.id, { progress: percent });
        }, tags)
          .then(() => {
            updateUpload(task.id, { status: 'done', progress: 100 });
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : '上传失败';
            updateUpload(task.id, { status: 'error', error: msg });
          });
      });
    },
    [config, effectiveUploadDir, addUploads, updateUpload, setError],
  );

  const enterPickerDir = async (dir: string) => {
    const normalized = normalizeDir(dir);
    setPickerDir(normalized);
    setUploadDir(normalized);
    setError('');
    try {
      await loadPickerFolders(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`读取目录失败：${message}`);
    }
  };

  const handleCreateFolder = async () => {
    if (!config) {
      setError('请先配置 OSS 连接。');
      return;
    }

    const cleaned = folderName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleaned) {
      setError('文件夹名称不能为空。');
      return;
    }

    setCreatingFolder(true);
    setError('');
    try {
      await createFolder(config, pickerDir, cleaned);
      setFolderName('');
      await enterPickerDir(`${normalizeDir(pickerDir)}${cleaned}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`新建文件夹失败：${message}`);
    } finally {
      setCreatingFolder(false);
    }
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) {
      handleFiles(event.target.files);
      event.target.value = '';
    }
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      if (event.dataTransfer.files?.length) {
        handleFiles(event.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  const hasActive = uploads.some((task) => task.status === 'uploading');

  return (
    <section className="panel">
      <div className="section-head">
        <div className="section-title">
          <CloudUpload size={18} />
          <h2>上传文件</h2>
        </div>
        <p className="section-desc">先选目标目录，再拖拽或选择文件。上传过程会保留在当前页面中。</p>
      </div>

      <div className="upload-target-card">
        <div className="upload-target-header">
          <div className="move-dialog-title">
            <Folder size={16} />
            <span>上传目标目录</span>
          </div>
          <div className="upload-target-path">
            {`${normalizeRoot(config?.rootPath)}${normalizeDir(effectiveUploadDir)}` || '/'}
          </div>
        </div>

        <div className="breadcrumbs breadcrumbs-compact">
          {pickerCrumbs.map((crumb, index) => (
            <div key={crumb.path || 'root'} className="breadcrumb-item">
              <button
                type="button"
                className="breadcrumb-link"
                onClick={() => void enterPickerDir(crumb.path)}
                disabled={pickerLoading || creatingFolder || crumb.path === pickerDir}
              >
                {crumb.label}
              </button>
              {index < pickerCrumbs.length - 1 ? <ChevronRight size={14} className="breadcrumb-sep" /> : null}
            </div>
          ))}
        </div>

        <div className="folder-grid folder-grid-compact">
          {pickerLoading ? (
            <div className="empty-state empty-state-sm">
              <LoaderCircle size={20} className="spin" />
              <span>正在加载目录...</span>
            </div>
          ) : pickerFolders.length ? (
            pickerFolders.map((folder) => (
              <button
                key={folder.path}
                type="button"
                className="folder-card"
                onClick={() => void enterPickerDir(folder.path)}
                disabled={creatingFolder}
              >
                <Folder size={18} />
                <span>{folder.name}</span>
              </button>
            ))
          ) : (
            <div className="empty-state empty-state-sm">当前目录下没有子文件夹。</div>
          )}
        </div>

        <div className="folder-create-row">
          <input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="输入新文件夹名称"
            disabled={pickerLoading || creatingFolder}
          />
          <button
            type="button"
            className="button secondary"
            onClick={() => void handleCreateFolder()}
            disabled={pickerLoading || creatingFolder}
          >
            <FolderPlus size={16} />
            {creatingFolder ? '创建中...' : '创建'}
          </button>
        </div>
      </div>

      <div
        className={`upload-drop-zone${dragging ? ' dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={32} />
        <span>点击选择文件，或直接拖拽到这里</span>
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
                <small>
                  {formatSize(task.file.size)} · {task.targetDir ? `/${task.targetDir}` : '/'}
                </small>
              </div>
              {task.status === 'uploading' ? (
                <div className="upload-progress-bar">
                  <div className="upload-progress-fill" style={{ width: `${task.progress}%` }} />
                  <span>{task.progress}%</span>
                </div>
              ) : null}
              {task.status === 'done' ? <span className="upload-badge done">完成</span> : null}
              {task.status === 'error' ? <span className="upload-badge error">{task.error ?? '失败'}</span> : null}
            </div>
          ))}

          <div className="upload-actions">
            {!hasActive && uploads.some((task) => task.status === 'done') ? (
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
