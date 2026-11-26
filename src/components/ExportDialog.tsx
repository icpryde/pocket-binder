import { useEffect, useMemo, useState } from 'react';
import type { Catalog, RarityTier } from '../data/types';
import { POST_TIER_ORDER, TIER_BY_ID } from '../data/rarity';
import { buildTradePost, collectLists, DISCORD_LIMIT } from '../export/tradePost';
import { renderCollage, type CollageBlock } from '../export/collage';
import { notify, store, tradeCtx, useCollection, type CollageSection } from '../state/store';
import { tradeCopies } from '../state/trade';
import { downloadBlob } from '../util/transfer';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { TierIcon } from './TierIcon';

interface Props {
  catalog: Catalog;
  onClose: () => void;
  tagOf: (code: string) => string;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  notify('Copied. Paste it into Discord.');
}

const SECTION_LABELS: Record<CollageSection, string> = { lf: 'Looking for', ft: 'For trade', owned: 'Everything I have' };

export function ExportDialog({ catalog, onClose, tagOf }: Props) {
  const [tab, setTab] = useState<'text' | 'image'>('text');
  const counts = useCollection((s) => s.counts);
  const wanted = useCollection((s) => s.wanted);
  const locked = useCollection((s) => s.locked);
  const forTrade = useCollection((s) => s.forTrade);
  const settings = useCollection((s) => s.settings);
  const post = settings.post;
  const collage = settings.collage;
  const state = useMemo(() => ({ counts, wanted, locked, forTrade, settings }), [counts, wanted, locked, forTrade, settings]);

  const result = useMemo(() => buildTradePost(catalog, state), [catalog, state]);
  const tradeTiers = POST_TIER_ORDER.filter((t) => catalog.cards.some((c) => c.tier === t && c.tradeable));


  // ---- image tab
  const [shots, setShots] = useState<{ blob: Blob; url: string; name: string }[]>([]);
  const [progress, setProgress] = useState<string>();
  useEffect(() => () => shots.forEach((x) => URL.revokeObjectURL(x.url)), [shots]);
  // Settings changed: the old pictures are out of date.
  useEffect(() => setShots([]), [state]);

  const generate = async () => {
    const lists = collectLists(catalog, state, post.tiers, post.lfRule);
    const ctx = tradeCtx(state);
    const blocks: CollageBlock[] = [];
    for (const section of collage.sections) {
      if (section === 'lf') {
        blocks.push({
          title: 'Looking for',
          color: '#ff86bd',
          items: lists.flatMap((l) => l.lf).map((c) => ({ card: c, caption: tagOf(c.set) })),
        });
      } else if (section === 'ft') {
        blocks.push({
          title: 'For trade',
          color: '#4fe3cb',
          items: lists
            .flatMap((l) => l.ft)
            .map((c) => ({
              card: c,
              caption: tagOf(c.set),
              badge: collage.showCounts ? `×${tradeCopies(c, ctx)}` : undefined,
            })),
        });
      } else {
        const tiers = new Set<RarityTier>(post.tiers);
        blocks.push({
          title: 'My collection',
          color: '#ffd166',
          items: catalog.cards
            .filter((c) => !c.reprint && tiers.has(c.tier) && (counts[c.key] ?? 0) > 0)
            .map((c) => ({ card: c, caption: tagOf(c.set), badge: collage.showCounts ? `×${counts[c.key]}` : undefined })),
        });
      }
    }
    setProgress('Loading card art…');
    try {
      const tierText = POST_TIER_ORDER.filter((t) => post.tiers.includes(t))
        .map((t) => TIER_BY_ID.get(t)?.text)
        .join(' ');
      const out = await renderCollage(
        blocks,
        {
          columns: collage.columns,
          rowsPerImage: collage.rowsPerImage,
          theme: collage.theme,
          heading: `Trade list ${tierText}`,
          subheading: [
            settings.friendCode && `Friend code ${settings.friendCode}`,
            collage.sections.includes('ft') && collage.showCounts && 'numbers = spare copies',
          ]
            .filter(Boolean)
            .join('  ·  '),
          showCaptions: collage.showTags,
        },
        (done, total) => setProgress(`Loading card art ${done}/${total}…`),
      );
      const day = new Date().toISOString().slice(0, 10);
      setShots(
        out.map((blob, i) => ({
          blob,
          url: URL.createObjectURL(blob),
          name: out.length > 1 ? `trade-list-${day}-${i + 1}.jpg` : `trade-list-${day}.jpg`,
        })),
      );
    } catch (err) {
      notify(`Could not make the image: ${(err as Error).message}`);
    } finally {
      setProgress(undefined);
    }
  };

  const files = shots.map((x) => new File([x.blob], x.name, { type: x.blob.type }));
  const canShareFiles = typeof navigator !== 'undefined' && files.length > 0 && !!navigator.canShare?.({ files });
  const copyImage = async (blob: Blob) => {
    try {
      // Browsers only put PNG images on the clipboard.
      const png =
        blob.type === 'image/png'
          ? blob
          : await createImageBitmap(blob).then((bmp) => {
              const c = document.createElement('canvas');
              c.width = bmp.width;
              c.height = bmp.height;
              c.getContext('2d')!.drawImage(bmp, 0, 0);
              return new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('copy'))), 'image/png'));
            });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      notify('Image copied. Paste it into Discord.');
    } catch {
      notify("This browser won't copy images. Use Save instead.");
    }
  };

  return (
    <Modal title="Share your trade list" onClose={onClose} wide>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'text'} className={`tab ${tab === 'text' ? 'on' : ''}`} onClick={() => setTab('text')}>
          <Icon name="text" size={18} /> Discord text
        </button>
        <button role="tab" aria-selected={tab === 'image'} className={`tab ${tab === 'image' ? 'on' : ''}`} onClick={() => setTab('image')}>
          <Icon name="image" size={18} /> Images
        </button>
      </div>

      <div className="export-opts">
        <div className="opt-row">
          <span className="opt-label">Rarities</span>
          <div className="chips">
            {tradeTiers.map((t) => (
              <button
                key={t}
                className={`chip chip-tier ${post.tiers.includes(t) ? 'on' : ''}`}
                onClick={() =>
                  store.updatePost({ tiers: post.tiers.includes(t) ? post.tiers.filter((x) => x !== t) : [...post.tiers, t] })
                }
              >
                <TierIcon tier={t} />
              </button>
            ))}
          </div>
        </div>
        <div className="opt-row">
          <span className="opt-label">Looking for</span>
          <div className="seg">
            <button className={post.lfRule === 'wanted' ? 'on' : ''} onClick={() => store.updatePost({ lfRule: 'wanted' })}>
              Cards I marked as needed
            </button>
            <button className={post.lfRule === 'below-keep' ? 'on' : ''} onClick={() => store.updatePost({ lfRule: 'below-keep' })}>
              Every card I have fewer than {settings.keep} of
            </button>
          </div>
        </div>
        <div className="opt-row">
          <span className="opt-label">For trade</span>
          <span className="inline-num">
            {(['s1', 's2'] as RarityTier[]).some((t) => post.tiers.includes(t) && !settings.autoTradeTiers.includes(t))
              ? 'stars you marked as willing to trade, plus '
              : ''}
            cards I have more than
            <button className="icon-btn small" onClick={() => store.updateSettings({ keep: Math.max(0, settings.keep - 1) })} aria-label="Lower">
              <Icon name="minus" size={14} />
            </button>
            <b>{settings.keep}</b>
            <button className="icon-btn small" onClick={() => store.updateSettings({ keep: settings.keep + 1 })} aria-label="Raise">
              <Icon name="plus" size={14} />
            </button>
            of. Change which rarities do this in Settings.
          </span>
        </div>
      </div>

      {tab === 'text' ? (
        <>
          <div className="checks">
            <label className="check">
              <input type="checkbox" checked={post.includeLf} onChange={(e) => store.updatePost({ includeLf: e.target.checked })} />
              Looking for ({result.lfTotal})
            </label>
            <label className="check">
              <input type="checkbox" checked={post.includeFt} onChange={(e) => store.updatePost({ includeFt: e.target.checked })} />
              For trade ({result.ftTotal})
            </label>
            <label className="check">
              <input type="checkbox" checked={post.includeCode} onChange={(e) => store.updatePost({ includeCode: e.target.checked })} />
              Friend code line
            </label>
            <label className="check">
              <input type="checkbox" checked={post.shortenNames} onChange={(e) => store.updatePost({ shortenNames: e.target.checked })} />
              Short names (no “ex” on ◆◆◆◆, “TR” for Team Rocket's)
            </label>
            <label className="check">
              <input type="checkbox" checked={post.showSpareCounts} onChange={(e) => store.updatePost({ showSpareCounts: e.target.checked })} />
              Show how many spares (Rotom x5)
            </label>
          </div>
          {result.parts.length > 1 && (
            <p className="warn">
              This is longer than one Discord message ({result.text.length} of {DISCORD_LIMIT} characters), so it's split into{' '}
              {result.parts.length} messages. Copy and send them one after another.
            </p>
          )}
          {result.parts.length === 0 && <p className="muted">Nothing to post with these settings.</p>}
          {result.parts.map((part, i) => (
            <div key={i} className="post-part">
              <div className="post-head">
                <span className="muted small">
                  {result.parts.length > 1 ? `Message ${i + 1} of ${result.parts.length} · ` : ''}
                  {part.length} characters
                </span>
                <button className="btn btn-primary" onClick={() => copyText(part)}>
                  <Icon name="copy" size={18} /> Copy
                </button>
              </div>
              <pre className="post-text">{part}</pre>
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="checks">
            {(['lf', 'ft', 'owned'] as CollageSection[]).map((s) => (
              <label key={s} className="check">
                <input
                  type="checkbox"
                  checked={collage.sections.includes(s)}
                  onChange={(e) =>
                    store.updateCollage({
                      sections: e.target.checked
                        ? (['lf', 'ft', 'owned'] as CollageSection[]).filter((x) => x === s || collage.sections.includes(x))
                        : collage.sections.filter((x) => x !== s),
                    })
                  }
                />
                {SECTION_LABELS[s]}
              </label>
            ))}
            <label className="check">
              <input type="checkbox" checked={collage.showCounts} onChange={(e) => store.updateCollage({ showCounts: e.target.checked })} />
              Numbers on cards
            </label>
            <label className="check">
              <input type="checkbox" checked={collage.showTags} onChange={(e) => store.updateCollage({ showTags: e.target.checked })} />
              Set tag under each card
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={collage.theme === 'light'}
                onChange={(e) => store.updateCollage({ theme: e.target.checked ? 'light' : 'dark' })}
              />
              Light background
            </label>
            <label className="range">
              Rows per image <b>{collage.rowsPerImage || 'all'}</b>
              <input
                type="range"
                min={2}
                max={13}
                value={collage.rowsPerImage || 13}
                onChange={(e) => store.updateCollage({ rowsPerImage: Number(e.target.value) >= 13 ? 0 : Number(e.target.value) })}
              />
            </label>
            <label className="range">
              Cards per row <b>{collage.columns}</b>
              <input
                type="range"
                min={4}
                max={12}
                value={collage.columns}
                onChange={(e) => store.updateCollage({ columns: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="image-actions">
            <button className="btn btn-primary" onClick={generate} disabled={Boolean(progress)}>
              <Icon name="image" size={18} /> {shots.length ? 'Make them again' : 'Make the images'}
            </button>
            {shots.length > 0 && (
              <>
                {canShareFiles && (
                  <button className="btn" onClick={() => navigator.share({ files }).catch(() => undefined)}>
                    <Icon name="share" size={18} /> Share {shots.length > 1 ? `all ${shots.length}` : ''}
                  </button>
                )}
                <button className="btn" onClick={() => shots.forEach((x, i) => setTimeout(() => downloadBlob(x.blob, x.name), i * 300))}>
                  <Icon name="download" size={18} /> Save {shots.length > 1 ? `all ${shots.length}` : ''}
                </button>
              </>
            )}
            {progress && <span className="muted small">{progress}</span>}
          </div>
          {shots.length > 1 && (
            <p className="muted small">
              {shots.length} images, so every card stays sharp in Discord. Attach them all to one message
              {shots.length > 10 ? ' (Discord takes up to 10 per message, so post the rest in a second one)' : ''}.
            </p>
          )}
          {shots.map((x, i) => (
            <div key={x.url} className="collage-preview">
              <div className="collage-head">
                <span className="muted small">{shots.length > 1 ? `Image ${i + 1} of ${shots.length}` : 'Your image'}</span>
                <span className="btn-row">
                  {'ClipboardItem' in window && (
                    <button className="btn small" onClick={() => copyImage(x.blob)}>
                      <Icon name="copy" size={16} /> Copy
                    </button>
                  )}
                  <button className="btn small" onClick={() => downloadBlob(x.blob, x.name)}>
                    <Icon name="download" size={16} /> Save
                  </button>
                </span>
              </div>
              <img src={x.url} alt={`Trade list image ${i + 1} of ${shots.length}`} />
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
