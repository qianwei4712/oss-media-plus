import OSS from 'ali-oss';
import type { FolderItem, MediaItem, MediaKind, OSSConfig } from './types';

const imageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'];
const audioExt = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
const videoExt = ['mp4', 'webm', 'mov', 'm3u8', 'mkv'];
const defaultSignatureExpires = 7 * 24 * 60 * 60;

export const createClient = (config: OSSConfig) =>
  new OSS({
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    secure: config.secure ?? true,
  });

export const detectMediaKind = (name: string): MediaKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (imageExt.includes(ext)) return 'image';
  if (audioExt.includes(ext)) return 'audio';
  if (videoExt.includes(ext)) return 'video';
  return 'other';
};

export const detectMediaKindFromFile = (file: File, name: string): MediaKind => {
  const mime = file.type.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return detectMediaKind(name);
};

const encodeTagging = (tags: Record<string, string>) =>
  Object.entries(tags)
    .filter(([key, value]) => Boolean(key) && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

export const normalizeRoot = (rootPath?: string) => {
  if (!rootPath) return '';
  return rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
};

export const normalizeDir = (dir?: string) => {
  if (!dir) return '';
  const cleaned = dir.trim().replace(/^\/+/, '');
  if (!cleaned) return '';
  return cleaned.endsWith('/') ? cleaned : `${cleaned}/`;
};

export const uploadFile = async (
  config: OSSConfig,
  file: File,
  objectKey: string,
  onProgress?: (percent: number) => void,
  tags?: Record<string, string>,
) => {
  const client = createClient(config);
  const tagging = tags ? encodeTagging(tags) : '';
  const result = await client.put(objectKey, file, {
    mime: file.type,
    headers: tagging ? { 'x-oss-tagging': tagging } : undefined,
    progress: onProgress
      ? (percent: number) => {
          onProgress(Math.round(percent * 100));
        }
      : undefined,
  });
  return result;
};

export const listMediaObjects = async (config: OSSConfig) => {
  const client = createClient(config);
  const prefix = normalizeRoot(config.rootPath);
  const items: MediaItem[] = [];
  let nextMarker: string | undefined;

  do {
    const result = await client.list(
      {
        prefix,
        marker: nextMarker,
        'max-keys': 100,
      },
      {},
    );

    const objects = result.objects ?? [];
    objects.forEach((object) => {
      if (!object.name || object.name.endsWith('/')) return;
      const kind = detectMediaKind(object.name);
      if (kind === 'other') return;
      items.push({
        name: object.name.split('/').pop() ?? object.name,
        path: object.name,
        url: client.signatureUrl(object.name, { expires: defaultSignatureExpires }),
        size: object.size ?? 0,
        lastModified: object.lastModified ?? '',
        kind,
        storageClass: (object as any).storageClass,
      });
    });

    nextMarker = result.isTruncated ? result.nextMarker : undefined;
  } while (nextMarker);

  return items.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
};

const removeRootPrefix = (rootPrefix: string, value: string) => {
  if (!rootPrefix) return value;
  return value.startsWith(rootPrefix) ? value.slice(rootPrefix.length) : value;
};

export const listDirectory = async (config: OSSConfig, dir?: string) => {
  const client = createClient(config);
  const rootPrefix = normalizeRoot(config.rootPath);
  const prefix = `${rootPrefix}${normalizeDir(dir)}`;

  const items: MediaItem[] = [];
  const folderSet = new Set<string>();
  let nextMarker: string | undefined;

  do {
    const result = await client.list(
      {
        prefix,
        delimiter: '/',
        marker: nextMarker,
        'max-keys': 100,
      },
      {},
    );

    const prefixes = result.prefixes ?? [];
    prefixes.forEach((raw) => {
      const relative = normalizeDir(removeRootPrefix(rootPrefix, raw));
      if (relative) folderSet.add(relative);
    });

    const objects = result.objects ?? [];
    objects.forEach((object) => {
      if (!object.name || object.name.endsWith('/')) return;
      const kind = detectMediaKind(object.name);
      if (kind === 'other') return;
      items.push({
        name: object.name.split('/').pop() ?? object.name,
        path: object.name,
        url: client.signatureUrl(object.name, { expires: defaultSignatureExpires }),
        size: object.size ?? 0,
        lastModified: object.lastModified ?? '',
        kind,
        storageClass: (object as any).storageClass,
      });
    });

    nextMarker = result.isTruncated ? result.nextMarker : undefined;
  } while (nextMarker);

  const folders: FolderItem[] = Array.from(folderSet)
    .map((folderPath) => ({
      path: folderPath,
      name: folderPath.replace(/\/$/, '').split('/').pop() ?? folderPath,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    folders,
    items: items.sort((a, b) => b.lastModified.localeCompare(a.lastModified)),
  };
};

export const createFolder = async (config: OSSConfig, dir: string, folderName: string) => {
  const cleaned = folderName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleaned) {
    throw new Error('文件夹名称不能为空');
  }

  const client = createClient(config);
  const rootPrefix = normalizeRoot(config.rootPath);
  const folderKey = `${rootPrefix}${normalizeDir(dir)}${cleaned}/`;
  await client.put(folderKey, new Blob([]));
  return folderKey;
};

export const moveObject = async (config: OSSConfig, fromKey: string, toKey: string) => {
  const client = createClient(config);
  await client.copy(toKey, fromKey);
  await client.delete(fromKey);
};

export const restoreObject = async (
  config: OSSConfig,
  objectKey: string,
  storageClass?: string,
  days = 1,
  jobParameters: 'Standard' | 'Expedited' | 'Bulk' = 'Standard',
) => {
  const client = createClient(config) as any;
  const type = storageClass === 'ColdArchive' || storageClass === 'DeepColdArchive' ? storageClass : undefined;
  const options: any = { Days: days };
  if (type) {
    options.type = type;
    options.JobParameters = jobParameters;
  }
  return client.restore(objectKey, options);
};

export const signObjectUrl = (config: OSSConfig, objectKey: string, expires = defaultSignatureExpires) => {
  const client = createClient(config);
  return client.signatureUrl(objectKey, { expires });
};
