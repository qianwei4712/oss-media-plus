import { useMemo, useState } from 'react';
import { Cloud, KeyRound, RefreshCcw, Save } from 'lucide-react';
import { createClient } from '../oss';
import { useAppStore } from '../store';
import type { OSSConfig } from '../types';

const defaultConfig: OSSConfig = {
  region: '',
  bucket: '',
  accessKeyId: '',
  accessKeySecret: '',
  rootPath: '',
  recoveryPath: 'recovery/',
  secure: true,
};

interface ConfigPanelProps {
  onConnected: () => Promise<void>;
}

export function ConfigPanel({ onConnected }: ConfigPanelProps) {
  const savedConfig = useAppStore((state) => state.config);
  const setConfig = useAppStore((state) => state.setConfig);
  const setError = useAppStore((state) => state.setError);
  const [form, setForm] = useState<OSSConfig>({ ...defaultConfig, ...savedConfig });
  const [testing, setTesting] = useState(false);

  const isReady = useMemo(
    () => Boolean(form.region && form.bucket && form.accessKeyId && form.accessKeySecret),
    [form],
  );

  const updateField = (key: keyof OSSConfig, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveConfig = () => {
    if (!isReady) {
      setError('请先完整填写 OSS 配置。');
      return;
    }

    setConfig(form);
    setError('');
  };

  const testAndLoad = async () => {
    if (!isReady) {
      setError('请先完整填写 OSS 配置。');
      return;
    }

    setTesting(true);
    setError('');
    try {
      const client = createClient(form);
      await client.list({ prefix: form.rootPath, 'max-keys': 1 }, {});
      setConfig(form);
      await onConnected();
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setError(`连接失败，请检查密钥、Bucket 或 CORS：${message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="panel">
      <div className="section-head">
        <div className="section-title">
          <Cloud size={18} />
          <h2>OSS 配置</h2>
        </div>
        <p className="section-desc">连接信息保存在当前浏览器本地，保存后可直接测试并加载媒体数据。</p>
      </div>

      <div className="form-grid">
        <label>
          Region
          <input
            value={form.region}
            onChange={(event) => updateField('region', event.target.value)}
            placeholder="oss-cn-hangzhou"
          />
        </label>
        <label>
          Bucket
          <input
            value={form.bucket}
            onChange={(event) => updateField('bucket', event.target.value)}
            placeholder="my-media-bucket"
          />
        </label>
        <label>
          AccessKeyId
          <input
            value={form.accessKeyId}
            onChange={(event) => updateField('accessKeyId', event.target.value)}
            placeholder="LTAI..."
          />
        </label>
        <label>
          AccessKeySecret
          <input
            type="password"
            value={form.accessKeySecret}
            onChange={(event) => updateField('accessKeySecret', event.target.value)}
            placeholder="Secret"
          />
        </label>
        <label className="full-span">
          媒体根目录
          <input
            value={form.rootPath ?? ''}
            onChange={(event) => updateField('rootPath', event.target.value)}
            placeholder="media/"
          />
        </label>
        <label className="full-span">
          回收站基础路径
          <input
            value={form.recoveryPath ?? ''}
            onChange={(event) => updateField('recoveryPath', event.target.value)}
            placeholder="recovery/"
          />
        </label>
      </div>

      <div className="button-row">
        <button type="button" className="button secondary" onClick={saveConfig}>
          <Save size={16} />
          保存配置
        </button>
        <button type="button" className="button primary" onClick={testAndLoad} disabled={testing}>
          <RefreshCcw size={16} className={testing ? 'spin' : ''} />
          {testing ? '连接中...' : '测试并加载媒体'}
        </button>
      </div>

      <div className="hint-card">
        <KeyRound size={16} />
        <span>需要开启 CORS，并允许 `GET/HEAD`，同时暴露 `ETag` 等常见响应头。回收站路径按 Bucket 根目录解析。</span>
      </div>
    </section>
  );
}
