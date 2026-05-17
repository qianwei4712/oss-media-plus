import { useMemo } from 'react';
import { Image, Radio, Video } from 'lucide-react';
import { useAppStore } from '../store';

export function StatsPage() {
  const items = useAppStore((state) => state.items);

  const stats = useMemo(
    () => ({
      image: items.filter((item) => item.kind === 'image').length,
      audio: items.filter((item) => item.kind === 'audio').length,
      video: items.filter((item) => item.kind === 'video').length,
      total: items.length,
    }),
    [items],
  );

  return (
    <div className="page-single">
      <section className="panel">
        <div className="section-head">
          <div className="section-title">
            <h2>媒体统计</h2>
          </div>
          <p className="section-desc">基于当前列表即时统计，方便快速判断目录内容结构。</p>
        </div>

        <section className="stats-row stats-row-page">
          <article className="stat-card">
            <Image size={18} />
            <span>图片</span>
            <strong>{stats.image}</strong>
          </article>
          <article className="stat-card">
            <Radio size={18} />
            <span>音频</span>
            <strong>{stats.audio}</strong>
          </article>
          <article className="stat-card">
            <Video size={18} />
            <span>视频</span>
            <strong>{stats.video}</strong>
          </article>
          <article className="stat-card stat-card-total">
            <span>总数</span>
            <strong>{stats.total}</strong>
          </article>
        </section>
      </section>
    </div>
  );
}
