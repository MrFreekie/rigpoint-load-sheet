// Recent files (layer 2): reopen a show without browsing for it.

import type { RecentFile } from '../files/recent';
import { isoWithOffset } from '../files/show-io';
import { Dialog } from './Dialog';
import { formatDate } from './format';

function when(ms: number): string {
  const d = new Date(ms);
  return `${formatDate(isoWithOffset(d).slice(0, 10))} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

interface Props {
  files: RecentFile[];
  onOpen: (file: RecentFile) => void;
  onRemove: (file: RecentFile) => void;
  onClose: () => void;
}

export function RecentFilesDialog({ files, onOpen, onRemove, onClose }: Props) {
  return (
    <Dialog
      title="Recent files"
      onClose={onClose}
      actions={
        <button type="button" className="button" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="section-hint">
        Shows opened or saved in this browser. The browser may ask again for permission to use a file.
      </p>
      {files.length === 0 ? <p>No recent files.</p> : null}
      <ul className="recent-list">
        {files.map((f) => (
          <li key={`${f.name}-${f.usedAt}`}>
            <span className="recent-name">
              {f.name}
              <span className="recent-when">Last used {when(f.usedAt)}</span>
            </span>
            <span className="recent-actions">
              <button type="button" className="button primary" aria-label={`Open ${f.name}`} onClick={() => onOpen(f)}>
                Open
              </button>
              <button type="button" className="button" aria-label={`Remove ${f.name} from recent files`} onClick={() => onRemove(f)}>
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
