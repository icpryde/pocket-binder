import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildCatalog } from './data/catalog';
import { downloadLatest, loadBundled, loadSaved, newSets, REFRESH_AFTER_MS, signature } from './data/source';
import type { Card, RawBundle } from './data/types';
import { tagFor } from './export/tradePost';
import { applyFilters, EMPTY_FILTERS, facetCounts, activeFilterCount, type FilterCtx, type Filters } from './state/filters';
import { notify, store, tradeCtx, useCollection } from './state/store';
import { tradeCopies } from './state/trade';
import { CardGrid } from './components/CardGrid';
import { CardDetail } from './components/CardDetail';
import { ExportDialog } from './components/ExportDialog';
import { FilterPanel } from './components/FilterPanel';
import { Icon } from './components/Icon';
import { SettingsDialog } from './components/SettingsDialog';
import { Toast } from './components/Toast';
import { TradeDialog } from './components/TradeDialog';
import { SyncBadge, SyncPanel } from './components/SyncPanel';
import { Modal } from './components/Modal';
import type { TapMode } from './components/CardTile';

const FILTER_KEY = 'pocket-binder:filters:v1';
const MODE_KEY = 'pocket-binder:mode:v1';

function loadFilters(): Filters {
  try {
    const saved = localStorage.getItem(FILTER_KEY);
    if (saved) return { ...EMPTY_FILTERS, ...JSON.parse(saved) };
  } catch {
    /* ignore */
  }
  // First visit: open on the ◆◆◆◆ cards, the ones already counted.
  return { ...EMPTY_FILTERS, tiers: ['d4'] };
}

function loadMode(): TapMode {
  const m = localStorage.getItem(MODE_KEY);
  return m === 'need' || m === 'trade' || m === 'add' || m === 'remove' ? m : 'view';
}

const MODE_HINTS: Record<TapMode, string> = {
  view: 'Tap a card to see it big and change how many you have.',
  need: 'Tap the cards you need. Tap again to take them off your list.',
  trade: "Tap the cards you're willing to trade. Tap again to take them off your For Trade list.",
  add: 'Each tap adds one copy. Use it after opening packs or when you get a card in a trade.',
  remove: 'Each tap removes one copy. Use it when you trade a card away.',
};

const MODES: [TapMode, string, string][] = [
  ['view', 'View', 'eye'],
  ['need', 'Need', 'heart'],
  ['trade', 'Trade', 'swap'],
  ['add', '+1', 'plus'],
  ['remove', '−1', 'minus'],
];

export default function App() {
  const [raw, setRaw] = useState<RawBundle | null>(null);
  const [loadError, setLoadError] = useState<string>();
  const catalog = useMemo(() => (raw ? buildCatalog(raw) : null), [raw]);
  const rawRef = useRef<RawBundle | null>(null);
  rawRef.current = raw;

  const counts = useCollection((s) => s.counts);
  const wanted = useCollection((s) => s.wanted);
  const locked = useCollection((s) => s.locked);
  const forTrade = useCollection((s) => s.forTrade);
  const settings = useCollection((s) => s.settings);
  const presets = useCollection((s) => s.presets);
  const dismissed = useCollection((s) => s.dismissed);
  const undoLabel = useCollection(() => store.undoLabel());

  const [filters, setFiltersState] = useState<Filters>(loadFilters);
  const [mode, setModeState] = useState<TapMode>(loadMode);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [dialog, setDialog] = useState<'trade' | 'export' | 'settings' | 'sync' | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // The top bar's height changes with the screen width (it wraps to three rows on a phone) and with the
  // status bar in the Home Screen app. The filter column and set names pin themselves below it via --top.
  const topbarObserver = useRef<ResizeObserver | null>(null);
  const topbarRef = useCallback((el: HTMLElement | null) => {
    topbarObserver.current?.disconnect();
    topbarObserver.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--top', `${el.offsetHeight}px`));
    ro.observe(el, { box: 'border-box' });
    topbarObserver.current = ro;
  }, []);

  const setFilters = useCallback((f: Filters) => {
    setFiltersState(f);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(f));
    } catch {
      /* ignore */
    }
  }, []);
  const setMode = (m: TapMode) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
  };

  // ---- card data: saved copy or bundled snapshot first, then a background check online
  const refresh = useCallback(async (): Promise<string> => {
    const before = rawRef.current;
    const latest = await downloadLatest();
    setRaw(latest);
    if (!before || signature(before) === signature(latest)) return 'Card list is up to date.';
    const added = newSets(before, latest);
    return added.length
      ? `New cards: ${added.map((a) => `${a.name} (${a.added})`).join(', ')}`
      : 'Card list updated.';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadSaved();
      let first = saved;
      if (!first) {
        try {
          first = await loadBundled();
        } catch {
          /* go straight to the download */
        }
      }
      if (cancelled) return;
      if (first) setRaw(first);
      const stale = !saved || Date.now() - Date.parse(saved.fetchedAt) > REFRESH_AFTER_MS;
      if (!stale) return;
      try {
        const msg = await refresh();
        if (first && !cancelled && msg !== 'Card list is up to date.') notify(msg);
      } catch {
        if (!first && !cancelled) setLoadError('Could not load the card list. Check your internet connection and reload.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // "/" jumps to search, Cmd/Ctrl+Z undoes the last change
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        store.undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tagOf = useCallback((code: string) => (catalog ? tagFor(catalog, settings, code) : code), [catalog, settings]);

  const ctx: FilterCtx | null = useMemo(
    () =>
      catalog && {
        ...tradeCtx({ counts, locked, forTrade, settings }),
        wanted,
        showReprints: settings.showReprints,
        tags: new Map(catalog.sets.map((s) => [s.code, tagOf(s.code)])),
      },
    [catalog, counts, wanted, locked, forTrade, settings, tagOf],
  );
  const visible = useMemo(() => (catalog && ctx ? applyFilters(catalog.cards, filters, ctx) : []), [catalog, ctx, filters]);
  const facets = useMemo(() => (catalog && ctx ? facetCounts(catalog.cards, filters, ctx) : null), [catalog, ctx, filters]);

  const stats = useMemo(() => {
    let copies = 0;
    let needed = 0;
    let spares = 0;
    const seen = new Set<string>();
    for (const c of visible) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      const n = counts[c.key] ?? 0;
      copies += n;
      if (wanted[c.key]) needed += 1;
      if (ctx) spares += tradeCopies(c, ctx);
    }
    return { copies, needed, spares };
  }, [visible, counts, wanted, ctx]);

  if (!catalog || !ctx || !facets) {
    return (
      <div className="loading">
        <div className="logo big">PB</div>
        <p>{loadError ?? 'Loading cards…'}</p>
      </div>
    );
  }

  const nActive = activeFilterCount(filters);

  return (
    <div className="app">
      <header className="topbar" ref={topbarRef}>
        <div className="brand">
          <span className="logo">PB</span>
          <span className="brand-name">Pocket Binder</span>
        </div>
        <label className="search">
          <Icon name="search" size={18} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Search: mewtwo, rots, #042…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            aria-label="Search cards"
          />
        </label>
        <div className="seg modes" role="radiogroup" aria-label="What tapping a card does">
          {MODES.map(([m, label, icon]) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? `on mode-${m}` : ''} onClick={() => setMode(m)}>
              <Icon name={icon as 'eye'} size={16} fill={m === 'need' && mode === m} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="actions">
          <button className="btn filter-toggle" onClick={() => setShowFilters(true)}>
            <Icon name="filter" size={18} /> Filters{nActive ? ` (${nActive})` : ''}
          </button>
          <button className="btn" onClick={() => setDialog('trade')}>
            <Icon name="swap" size={18} /> <span className="hide-sm">Log trade</span>
          </button>
          <button className="btn btn-primary" onClick={() => setDialog('export')}>
            <Icon name="share" size={18} /> <span className="hide-sm">Share list</span>
          </button>
          <button className="icon-btn" onClick={() => setDialog('settings')} aria-label="Settings">
            <Icon name="gear" />
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className={`sidebar ${showFilters ? 'open' : ''}`} aria-label="Filters">
          <div className="sidebar-head">
            <h2>Filters</h2>
            <button className="btn btn-primary" onClick={() => setShowFilters(false)}>
              Show {visible.length} cards
            </button>
          </div>
          <FilterPanel
            catalog={catalog}
            filters={filters}
            setFilters={setFilters}
            facets={facets}
            counts={counts}
            keep={settings.keep}
            presets={presets}
            tagOf={tagOf}
          />
        </aside>
        {showFilters && <div className="scrim" onClick={() => setShowFilters(false)} />}

        <main className="main">
          {!dismissed.intro && (
            <div className="banner">
              <p>
                Your <b>◆◆◆◆</b>, <b>★</b>, <b>★★</b>, <b>★★★</b>, <b>crown</b> and <b>shiny</b> counts from the game are filled in, and the 7 you need are
                marked. Extras over 2 go on your For Trade list by themselves (★★★ and crown can't be traded). To trade a card you only have 1 or 2 of, use{' '}
                <b>Trade</b> mode and tap it.
              </p>
              <button className="icon-btn small" onClick={() => store.dismiss('intro')} aria-label="Dismiss">
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          <div className="summary">
            <span>
              <b>{visible.length.toLocaleString()}</b> cards
            </span>
            <span>
              <b>{stats.copies.toLocaleString()}</b> copies
            </span>
            <span className="s-need">
              <Icon name="heart" size={14} fill /> <b>{stats.needed}</b> needed
            </span>
            <span className="s-spare">
              <b>{stats.spares}</b> for trade
            </span>
            {nActive > 0 && (
              <button className="link-btn" onClick={() => setFilters({ ...EMPTY_FILTERS, sort: filters.sort, group: filters.group })}>
                Clear filters
              </button>
            )}
            <SyncBadge onOpen={() => setDialog('sync')} />
            {undoLabel && (
              <button className="link-btn undo-link" onClick={() => store.undo()} title={`Undo: ${undoLabel}`}>
                <Icon name="undo" size={14} /> Undo
              </button>
            )}
          </div>
          <p className={`mode-hint mode-${mode}`}>{MODE_HINTS[mode]}</p>
          <CardGrid
            catalog={catalog}
            cards={visible}
            filters={filters}
            counts={counts}
            wanted={wanted}
            trade={ctx}
            mode={mode}
            tagOf={tagOf}
            onOpen={setOpenCard}
            onReset={() => setFilters({ ...EMPTY_FILTERS })}
          />
          <footer className="credits">
            Card data and thumbnails: pokemon-tcg-pocket-database / pokemon-tcg.exchange. Larger scans: Limitless TCG. Pokémon and card art ©
            Nintendo, Creatures, GAME FREAK and The Pokémon Company. Fan-made, not affiliated.
          </footer>
        </main>
      </div>

      {openCard && (
        <CardDetail
          card={openCard}
          catalog={catalog}
          list={visible}
          onNavigate={setOpenCard}
          onClose={() => setOpenCard(null)}
          tagOf={tagOf}
        />
      )}
      {dialog === 'trade' && <TradeDialog catalog={catalog} onClose={() => setDialog(null)} tagOf={tagOf} />}
      {dialog === 'export' && <ExportDialog catalog={catalog} onClose={() => setDialog(null)} tagOf={tagOf} />}
      {dialog === 'settings' && (
        <SettingsDialog catalog={catalog} onClose={() => setDialog(null)} onRefresh={refresh} onOpenSync={() => setDialog('sync')} />
      )}
      {dialog === 'sync' && (
        <Modal title="Sync between devices" onClose={() => setDialog(null)}>
          <SyncPanel />
        </Modal>
      )}
      <Toast />
    </div>
  );
}
