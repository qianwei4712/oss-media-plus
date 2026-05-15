import { useOutletContext } from 'react-router-dom';
import { UploadPanel } from '../components/UploadPanel';
import type { AppLayoutContext } from '../layouts/AppLayout';

export function UploadPage() {
  const { loadMedia } = useOutletContext<AppLayoutContext>();

  return (
    <div className="page-single">
      <UploadPanel onUploaded={loadMedia} />
    </div>
  );
}

