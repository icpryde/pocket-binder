import { useState } from 'react';
import { REPO } from '../sync/github';
import { connect, disconnect, retry, syncNow, useSyncStatus } from '../sync/sync';
import { Icon } from './Icon';

const TOKENS_URL = 'https://github.com/settings/personal-access-tokens';

/** Turn sync on for this device, see its state, or turn it off. */
export function SyncPanel() {
  const status = useSyncStatus();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const last = status.lastSynced
    ? new Date(status.lastSynced).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null;

  const tokenForm = (
    <>
      <label className="field">
        <span>Access token</span>
        <input
          type="password"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && document.getElementById('sync-connect')?.click()}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="github_pat_…"
        />
      </label>
      {error && <p className="warn">{error}</p>}
      <button
        id="sync-connect"
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const err = await connect(input);
          setBusy(false);
          if (err) setError(err);
          else setInput('');
        }}
      >
        <Icon name="cloud" size={18} /> {busy ? 'Checking…' : 'Connect this device'}
      </button>
    </>
  );

  if (!status.connected) {
    return (
      <div className="sync-panel">
        <p>
          Sync keeps your counts, needs and trade lists the same on your iPhone and your computer. Changes save to your own GitHub repo about a
          second after you make them. You make a token once, then paste it on each device.
        </p>
        <ol className="steps">
          <li>
            Open{' '}
            <a href={`${TOKENS_URL}/new`} target="_blank" rel="noopener noreferrer">
              GitHub's new token page
            </a>{' '}
            (signed in as you).
          </li>
          <li>
            Name it <b>Pocket Binder</b> and pick an expiration. A year is fine.
          </li>
          <li>
            Under <b>Repository access</b>, choose <b>Only select repositories</b> and pick <b>{REPO.repo}</b>.
          </li>
          <li>
            Under <b>Permissions</b> → <b>Repositories</b>, click <b>Add permissions</b>, choose <b>Contents</b> and set it to <b>Read and write</b>.
          </li>
          <li>
            Click <b>Generate token</b>, copy it (it starts with <b>github_pat_</b>) and paste it below.
          </li>
        </ol>
        {tokenForm}
        <p className="muted small">
          The token is saved in this browser only and is sent nowhere but GitHub. On iPhone, the home-screen icon has its own storage, so connect
          inside it too. The first time a device connects, anything you changed on it is merged in, not thrown away.
        </p>
      </div>
    );
  }

  return (
    <div className="sync-panel">
      <p className={`sync-line sync-${status.state}`}>
        <span className="sync-dot" /> {status.text}
        {last && status.state === 'synced' ? ` · ${last}` : ''}
      </p>
      {status.problem === 'expired' && (
        <>
          <p className="warn">
            Your token expired or was deleted. On GitHub, open{' '}
            <a href={TOKENS_URL} target="_blank" rel="noopener noreferrer">
              your tokens
            </a>
            , click <b>Pocket Binder</b>, then <b>Regenerate token</b>, and paste the new one here.
          </p>
          {tokenForm}
        </>
      )}
      {status.problem === 'perms' && (
        <p className="warn">
          Your token can't save. On GitHub, open{' '}
          <a href={TOKENS_URL} target="_blank" rel="noopener noreferrer">
            your tokens
          </a>
          , click <b>Pocket Binder</b>, then <b>Edit</b>: pick <b>{REPO.repo}</b> under Only select repositories and set <b>Contents</b> to{' '}
          <b>Read and write</b>. Then tap <b>Try again</b>.
        </p>
      )}
      <p className="muted small">
        This device saves changes about a second after you make them. Your other devices pick them up within 30 seconds, or right away when you
        switch back to them.
      </p>
      <div className="btn-row">
        <button className="btn" onClick={() => (status.problem ? retry() : syncNow())}>
          <Icon name="refresh" size={18} /> {status.problem ? 'Try again' : 'Sync now'}
        </button>
        <button
          className="btn"
          onClick={() => {
            if (window.confirm('Stop syncing on this device? Your collection stays here, it just stops saving to GitHub.')) disconnect();
          }}
        >
          Disconnect this device
        </button>
      </div>
    </div>
  );
}

/** Small status link for the summary row. */
export function SyncBadge({ onOpen }: { onOpen: () => void }) {
  const status = useSyncStatus();
  return (
    <button className={`link-btn sync-badge sync-${status.state}`} onClick={onOpen} title="Sync between devices">
      <Icon name="cloud" size={14} /> {status.connected ? status.text : 'Sync'}
    </button>
  );
}
