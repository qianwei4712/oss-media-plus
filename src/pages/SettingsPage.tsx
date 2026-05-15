import { useOutletContext } from 'react-router-dom';
import { ConfigPanel } from '../components/ConfigPanel';
import type { AppLayoutContext } from '../layouts/AppLayout';

export function SettingsPage() {
  const { loadMedia } = useOutletContext<AppLayoutContext>();

  return (
    <div className="page-single">
      <ConfigPanel onConnected={loadMedia} />
    </div>
  );
}

