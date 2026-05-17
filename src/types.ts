export interface OSSConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  rootPath?: string;
  recoveryPath?: string;
  secure?: boolean;
}

export type MediaKind = 'image' | 'audio' | 'video' | 'other';

export interface MediaItem {
  name: string;
  path: string;
  url: string;
  size: number;
  lastModified: string;
  kind: MediaKind;
  storageClass?: string;
}

export interface FolderItem {
  name: string;
  path: string;
}

export interface RecoveryItem extends MediaItem {
  originalPath: string;
  recoveryObjectKey: string;
  deletedAt: string;
}

export type MediaSort = 'name-asc' | 'name-desc';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadTask {
  id: string;
  file: File;
  objectKey: string;
  targetDir: string;
  status: UploadStatus;
  progress: number;
  error?: string;
}

export interface BatchOperationFailure {
  key: string;
  reason: string;
}

export interface BatchOperationResult {
  successCount: number;
  failureCount: number;
  failures: BatchOperationFailure[];
}
