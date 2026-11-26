import { useRef, useState } from 'react';
import type { Catalog, RarityTier } from '../data/types';
import { defaultTag } from '../data/setTags';
import { notify, store, useCollection } from '../state/store';
import { downloadBackup, makeTransferCode, readBackupFile, readTransferCode } from '../util/transfer';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { TierIcon } from './TierIcon';

const TRADE_TIERS: RarityTier[] = ['d1', 'd2', 'd3', 'd4', 's1', 's2', 'sh1', 'sh2'];

interface Props {
  catalog: Catalog;
  onClose: () => void;
  onRefresh: () => Promise<string>;
}

export function SettingsDialog({ catalog, onClose, onRefresh }: Props) {
  const settings = useCollection((s) => s.settings);
  const fileRef = useRef<HTMLInputElement>(null);
  const [checking, setChecking] = useState(false);
  const [code, setCode] = useState('');
  const [made, setMade] = useState('');

  const cardTotal = catalog.byKey.size;
  const updated = new Date(catalog.fetchedAt);

  return (
    <Modal title="Settings" onClose={onClose} wide>
      <div className="settings">
        <section>
          <h3>Trading</h3>
          <label className="field">
            <span>Friend code</span>
            <input
              value={settings.friendCode}
              inputMode="numeric"
              placeholder="16-digit friend code"
              onChange={(e) => store.updateSettings({ friendCode: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Copies to keep of each card</span>
            <span className="inline-num">
              <button className="icon-btn small" onClick={() => store.updateSettings({ keep: Math.max(0, settings.keep - 1) })} aria-label="Lower">
                <Icon name="minus" size={14} />
              </button>
              <b>{settings.keep}</b>
              <button className="icon-btn small" onClick={() => store.updateSettings({ keep: settings.keep + 1 })} aria-label="Raise">
                <Icon name="plus" size={14} />
              </button>
            </span>
            <small className="muted">Fewer than this = you need it. More than this = the extras go on your trade list.</small>
          </label>
          <div className="field">
            <span>Put extras on my For Trade list automatically for</span>
            <div className="chips">
              {TRADE_TIERS.map((t) => {
                const on = settings.autoTradeTiers.includes(t);
                return (
                  <button
                    key={t}
                    className={`chip chip-tier ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    onClick={() =>
                      store.updateSettings({
                        autoTradeTiers: on ? settings.autoTradeTiers.filter((x) => x !== t) : [...settings.autoTradeTiers, t],
                      })
                    }
                  >
                    <TierIcon tier={t} />
                  </button>
                );
              })}
            </div>
            <small className="muted">
              Rarities that are off only list the cards you pick as willing to trade (Trade mode, or the button on a card).
            </small>
          </div>
          <label className="check">
            <input type="checkbox" checked={settings.autoUnwant} onChange={(e) => store.updateSettings({ autoUnwant: e.target.checked })} />
            Take a card off my need list once I have {settings.keep}
          </label>
          <label className="check">
            <input type="checkbox" checked={settings.showReprints} onChange={(e) => store.updateSettings({ showReprints: e.target.checked })} />
            Also show Deluxe Pack reprints in the grid (they share one count with the original)
          </label>
        </section>

        <section>
          <h3>Set tags in posts</h3>
          <p className="muted small">The short name in brackets, like [RotS]. Leave a box empty to use the default.</p>
          <div className="tag-grid">
            {catalog.sets.map((s) => (
              <label key={s.code} className="tag-row">
                <span>{s.name}</span>
                <input
                  value={settings.setTags[s.code] ?? ''}
                  placeholder={defaultTag(s.code, s.name)}
                  onChange={(e) => store.updateSettings({ setTags: { ...settings.setTags, [s.code]: e.target.value } })}
                />
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3>Card list</h3>
          <p className="muted small">
            {cardTotal.toLocaleString()} cards in {catalog.sets.length} sets, from the community Pocket card database (
            {catalog.source === 'bundled' ? 'copy built into the app' : catalog.source}), updated{' '}
            {updated.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}. New expansions are added on their own, usually within a
            day of release. The app checks every few hours.
          </p>
          <button
            className="btn"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              try {
                notify(await onRefresh());
              } finally {
                setChecking(false);
              }
            }}
          >
            <Icon name="refresh" size={18} /> {checking ? 'Checking…' : 'Check for new cards now'}
          </button>
        </section>

        <section>
          <h3>Backup and other devices</h3>
          <p className="muted small">
            Your collection is saved in this browser only. To use it on your phone too, copy a transfer code here and paste it into the app there (or
            send yourself a backup file).
          </p>
          <div className="btn-row">
            <button className="btn" onClick={() => downloadBackup(store.get())}>
              <Icon name="download" size={18} /> Download backup file
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="share" size={18} /> Restore from backup file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const next = await readBackupFile(file);
                  if (window.confirm('Replace your current collection with this backup?')) store.replaceAll(next, 'Restored from backup');
                } catch (err) {
                  notify((err as Error).message);
                }
              }}
            />
          </div>
          <div className="btn-row">
            <button
              className="btn"
              onClick={async () => {
                const c = await makeTransferCode(store.get());
                setMade(c);
                try {
                  await navigator.clipboard.writeText(c);
                  notify('Transfer code copied');
                } catch {
                  /* shown below for manual copy */
                }
              }}
            >
              <Icon name="copy" size={18} /> Copy transfer code
            </button>
          </div>
          {made && <textarea className="code-box" readOnly value={made} onFocus={(e) => e.target.select()} rows={3} />}
          <label className="field">
            <span>Paste a transfer code from another device</span>
            <textarea className="code-box" value={code} onChange={(e) => setCode(e.target.value)} rows={3} placeholder="PB1.…" />
          </label>
          <button
            className="btn"
            disabled={!code.trim()}
            onClick={async () => {
              try {
                const next = await readTransferCode(code, store.get());
                if (window.confirm('Replace your counts, needs and settings with the ones from this code?')) {
                  store.replaceAll(next, 'Loaded collection from transfer code');
                  setCode('');
                }
              } catch (err) {
                notify((err as Error).message || 'That code could not be read.');
              }
            }}
          >
            Load this code
          </button>
        </section>

        <section>
          <h3>Start over</h3>
          <button
            className="btn btn-danger"
            onClick={() =>
              window.confirm('Reset every count to the starting ◆◆◆◆ counts from Nov 25? You can undo this right after.') && store.resetToStart()
            }
          >
            Reset to starting counts
          </button>
        </section>
      </div>
    </Modal>
  );
}
