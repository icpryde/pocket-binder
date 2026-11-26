import { clearNotice, store, useNotice } from '../state/store';
import { Icon } from './Icon';

export function Toast() {
  const notice = useNotice();
  if (!notice) return null;
  return (
    <div className="toast" role="status" key={notice.id}>
      <span>{notice.text}</span>
      {notice.undoable && (
        <button
          className="toast-undo"
          onClick={() => {
            store.undo();
          }}
        >
          <Icon name="undo" size={16} /> Undo
        </button>
      )}
      <button className="icon-btn small" onClick={clearNotice} aria-label="Dismiss">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
