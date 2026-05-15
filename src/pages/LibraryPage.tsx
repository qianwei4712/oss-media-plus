import { useState } from 'react';
import { MediaGrid } from '../components/MediaGrid';
import { PlayerPanel } from '../components/PlayerPanel';
import { useAppStore } from '../store';
import type { MediaKind } from '../types';

export function LibraryPage() {
  const items = useAppStore((state) => state.items);
  const current = useAppStore((state) => state.current);
  const setCurrent = useAppStore((state) => state.setCurrent);
  const [activeKind, setActiveKind] = useState<MediaKind | 'all'>('all');

  return (
    <main className="content-grid">
      <div className="left-column">
        <MediaGrid
          items={items}
          activeKind={activeKind}
          onKindChange={setActiveKind}
          onSelect={setCurrent}
          selectedPath={current?.path}
        />
      </div>
      <PlayerPanel item={current} />
    </main>
  );
}

