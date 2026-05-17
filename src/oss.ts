import OSS from 'ali-oss';
import type { BatchOperationResult, FolderItem, MediaItem, MediaKind, MediaSort, OSSConfig, RecoveryItem } from './types';

const imageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'];
const audioExt = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
const videoExt = ['mp4', 'webm', 'mov', 'm3u8', 'mkv'];
const defaultSignatureExpires = 7 * 24 * 60 * 60;
const defaultRecoveryDir = 'recovery';

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

export const normalizeRecoveryDir = (recoveryPath?: string) => normalizeDir(recoveryPath || defaultRecoveryDir);

const getRecoveryPrefix = (config: OSSConfig) => normalizeRecoveryDir(config.recoveryPath);

const buildRecoveryObjectKey = (config: OSSConfig, objectKey: string) => {
  const recoveryPrefix = getRecoveryPrefix(config);
  return `${recoveryPrefix}${Date.now()}__${encodeURIComponent(objectKey)}`;
};

const parseRecoveryObjectKey = (config: OSSConfig, objectKey: string) => {
  const recoveryPrefix = getRecoveryPrefix(config);
  if (!objectKey.startsWith(recoveryPrefix)) {
    return null;
  }

  const payload = objectKey.slice(recoveryPrefix.length);
  const separatorIndex = payload.indexOf('__');
  if (separatorIndex === -1) {
    return null;
  }

  const deletedAtRaw = payload.slice(0, separatorIndex);
  const originalPathRaw = payload.slice(separatorIndex + 2);
  if (!originalPathRaw) {
    return null;
  }

  const deletedAtMs = Number(deletedAtRaw);
  const deletedAt = Number.isFinite(deletedAtMs) ? new Date(deletedAtMs).toISOString() : '';

  try {
    return {
      deletedAt,
      originalPath: decodeURIComponent(originalPathRaw),
    };
  } catch {
    return null;
  }
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
  const recoveryPrefix = getRecoveryPrefix(config);
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
      if (object.name.startsWith(recoveryPrefix)) return;
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

const compareMediaByName = (left: MediaItem, right: MediaItem, sort: MediaSort) => {
  const base = left.name.localeCompare(right.name, 'zh-CN', { sensitivity: 'base' });
  const tieBreaker = left.path.localeCompare(right.path, 'zh-CN', { sensitivity: 'base' });
  const resolved = base || tieBreaker;
  return sort === 'name-desc' ? -resolved : resolved;
};

export const searchMediaObjects = async (
  config: OSSConfig,
  options: { query: string; sort: MediaSort },
) => {
  const query = options.query.trim().toLowerCase();
  const items = await listMediaObjects(config);
  const filtered = items.filter((item) => item.name.toLowerCase().includes(query));
  return filtered.sort((left, right) => compareMediaByName(left, right, options.sort));
};

const removeRootPrefix = (rootPrefix: string, value: string) => {
  if (!rootPrefix) return value;
  return value.startsWith(rootPrefix) ? value.slice(rootPrefix.length) : value;
};

export const listDirectory = async (config: OSSConfig, dir?: string) => {
  const client = createClient(config);
  const rootPrefix = normalizeRoot(config.rootPath);
  const recoveryPrefix = getRecoveryPrefix(config);
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
      if (raw === recoveryPrefix) return;
      const relative = normalizeDir(removeRootPrefix(rootPrefix, raw));
      if (relative) folderSet.add(relative);
    });

    const objects = result.objects ?? [];
    objects.forEach((object) => {
      if (!object.name || object.name.endsWith('/')) return;
      if (object.name.startsWith(recoveryPrefix)) return;
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

const objectExists = async (config: OSSConfig, objectKey: string) => {
  const client = createClient(config);
  try {
    await client.head(objectKey);
    return true;
  } catch (error) {
    if ((error as any)?.status === 404) {
      return false;
    }
    throw error;
  }
};

export const moveObjectToRecovery = async (config: OSSConfig, objectKey: string) => {
  const recoveryObjectKey = buildRecoveryObjectKey(config, objectKey);
  await moveObject(config, objectKey, recoveryObjectKey);
  return recoveryObjectKey;
};

export const listRecoveryItems = async (config: OSSConfig) => {
  const client = createClient(config);
  const recoveryPrefix = getRecoveryPrefix(config);
  const items: RecoveryItem[] = [];
  let nextMarker: string | undefined;

  do {
    const result = await client.list(
      {
        prefix: recoveryPrefix,
        marker: nextMarker,
        'max-keys': 100,
      },
      {},
    );

    const objects = result.objects ?? [];
    objects.forEach((object) => {
      if (!object.name || object.name.endsWith('/')) return;
      const parsed = parseRecoveryObjectKey(config, object.name);
      if (!parsed) return;
      const kind = detectMediaKind(parsed.originalPath);
      if (kind === 'other') return;
      items.push({
        name: parsed.originalPath.split('/').pop() ?? parsed.originalPath,
        path: object.name,
        recoveryObjectKey: object.name,
        originalPath: parsed.originalPath,
        deletedAt: parsed.deletedAt || object.lastModified || '',
        url: client.signatureUrl(object.name, { expires: defaultSignatureExpires }),
        size: object.size ?? 0,
        lastModified: object.lastModified ?? '',
        kind,
        storageClass: (object as any).storageClass,
      });
    });

    nextMarker = result.isTruncated ? result.nextMarker : undefined;
  } while (nextMarker);

  return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
};
export const restoreRecoveryObject = async (config: OSSConfig, recoveryObjectKey: string) => {
  const parsed = parseRecoveryObjectKey(config, recoveryObjectKey);
  if (!parsed) {
    throw new Error('无法解析回收站对象的原始路径');
  }
  if (await objectExists(config, parsed.originalPath)) {
    throw new Error('原路径已存在同名对象，已阻止恢复覆盖');
  }

  await moveObject(config, recoveryObjectKey, parsed.originalPath);
  return parsed.originalPath;
};

export const restoreRecoveryObjects = async (
  config: OSSConfig,
  recoveryObjectKeys: string[],
): Promise<BatchOperationResult> => {
  if (!recoveryObjectKeys.length) {
    return { successCount: 0, failureCount: 0, failures: [] };
  }

  let successCount = 0;
  const failures: Array<{ key: string; reason: string }> = [];

  for (const recoveryObjectKey of recoveryObjectKeys) {
    try {
      await restoreRecoveryObject(config, recoveryObjectKey);
      successCount += 1;
    } catch (error) {
      failures.push({
        key: recoveryObjectKey,
        reason: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
};

export const deleteObject = async (config: OSSConfig, objectKey: string) => {
  const client = createClient(config);
  await client.delete(objectKey);
};

export const deleteObjects = async (config: OSSConfig, objectKeys: string[]): Promise<BatchOperationResult> => {
  if (!objectKeys.length) {
    return { successCount: 0, failureCount: 0, failures: [] };
  }

  let successCount = 0;
  const failures: Array<{ key: string; reason: string }> = [];

  for (const objectKey of objectKeys) {
    try {
      await deleteObject(config, objectKey);
      successCount += 1;
    } catch (error) {
      failures.push({
        key: objectKey,
        reason: error instanceof Error ? error.message : '未知错误',
      });
    }
  }

  return {
    successCount,
    failureCount: failures.length,
    failures,
  };
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
