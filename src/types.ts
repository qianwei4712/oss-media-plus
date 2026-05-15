export interface OSSConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  rootPath?: string;
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
}

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

export interface UploadTask {
  id: string;
  file: File;
  objectKey: string;
  status: UploadStatus;
  progress: number;
  error?: string;
}
