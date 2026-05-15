import OSS from 'ali-oss';
import type { MediaItem, MediaKind, OSSConfig } from './types';

const imageExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'];
const audioExt = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'];
const videoExt = ['mp4', 'webm', 'mov', 'm3u8', 'mkv'];

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

export const normalizeRoot = (rootPath?: string) => {
  if (!rootPath) return '';
  return rootPath.endsWith('/') ? rootPath : `${rootPath}/`;
};

export const uploadFile = async (
  config: OSSConfig,
  file: File,
  objectKey: string,
  onProgress?: (percent: number) => void,
) => {
  const client = createClient(config);
  const result = await client.put(objectKey, file, {
    mime: file.type,
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
        url: client.signatureUrl(object.name, { expires: 3600 }),
        size: object.size ?? 0,
        lastModified: object.lastModified ?? '',
        kind,
      });
    });

    nextMarker = result.isTruncated ? result.nextMarker : undefined;
  } while (nextMarker);

  return items.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
};
