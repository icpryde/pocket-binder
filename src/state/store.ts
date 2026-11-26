// The user's collection: copy counts, "need" marks, "not for trade" locks, settings,
// saved filters and a history of changes. Kept in this browser's localStorage and
// exportable as a backup file or a transfer code (see util/transfer.ts).
import { useSyncExternalStore } from 'react';
import type { Card, RarityTier } from '../data/types';
import type { Filters } from './filters';
import { SEED_COUNTS, SEED_FRIEND_CODE, SEED_STAR_COUNTS, SEED_WANTED } from './seed';
import { autoQualifies, DEFAULT_AUTO_TRADE_TIERS, isForTrade, type TradeCtx } from './trade';

export type LfRule = 'wanted' | 'below-keep';
export type CollageSection = 'lf' | 'ft' | 'owned';

export interface PostSettings {
  tiers: RarityTier[];
  lfRule: LfRule;
  includeLf: boolean;
  includeFt: boolean;
  includeCode: boolean;
  shortenNames: boolean;
  showSpareCounts: boolean;
}

export interface CollageSettings {
  sections: CollageSection[];
  columns: number;
  /** Card rows per image; 0 = one long image. */
  rowsPerImage: number;
  showCounts: boolean;
  showTags: boolean;
  theme: 'dark' | 'light';
}

export interface Settings {
  friendCode: string;
  /** Copies to keep for decks. Fewer = need, more = spares for trade. */
  keep: number;
  /** Drop a card from the need list once you reach the keep number. */
  autoUnwant: boolean;
  /** Rarities whose spares go on the For Trade list automatically. Others only when picked. */
  autoTradeTiers: RarityTier[];
  showReprints: boolean;
  setTags: Record<string, string>;
  post: PostSettings;
  collage: CollageSettings;
}

export type Reason = 'tap' | 'edit' | 'trade' | 'bulk' | 'import';

export interface LogEntry {
  t: number;
  key: string;
  from: number;
  to: number;
  reason: Reason;
}

export interface TradeRecord {
  t: number;
  give?: string;
  get?: string;
}

export interface SavedPreset {
  id: string;
  name: string;
  filters: Filters;
}

export interface CollectionState {
  version: 1;
  counts: Record<string, number>;
  wanted: Record<string, true>;
  /** "Never trade" marks. */
  locked: Record<string, true>;
  /** "Willing to trade" marks, picked by hand. */
  forTrade: Record<string, true>;
  settings: Settings;
  presets: SavedPreset[];
  log: LogEntry[];
  trades: TradeRecord[];
  dismissed: Record<string, true>;
}

const STORAGE_KEY = 'pocket-binder:collection:v1';
/** Marks that the ★/★★ counts were added to a collection saved before they existed. */
const STAR_IMPORT = 'import-stars-2026-11-25';
/** Marks that ★ and ★★ were added to the automatic-trade rarities of an older save. */
const ONE_STAR_AUTO = 'auto-trade-1-star-2026-11-26';
const TWO_STAR_AUTO = 'auto-trade-2-star-2026-11-26';
const MAX_LOG = 1000;

export const DEFAULT_SETTINGS: Settings = {
  friendCode: '',
  keep: 2,
  autoUnwant: true,
  autoTradeTiers: DEFAULT_AUTO_TRADE_TIERS,
  showReprints: false,
  setTags: {},
  post: {
    tiers: ['d4'],
    lfRule: 'wanted',
    includeLf: true,
    includeFt: true,
    includeCode: true,
    shortenNames: true,
    showSpareCounts: false,
  },
  collage: {
    sections: ['lf', 'ft'],
    columns: 8,
    rowsPerImage: 3,
    showCounts: true,
    showTags: true,
    theme: 'dark',
  },
};

/** The collection the app starts with (also the common starting point for sync). */
export function startingCollection(): CollectionState {
  return seedState();
}

function seedState(): CollectionState {
  return {
    version: 1,
    counts: { ...SEED_COUNTS, ...SEED_STAR_COUNTS },
    wanted: Object.fromEntries(SEED_WANTED.map((k) => [k, true as const])),
    locked: {},
    forTrade: {},
    settings: { ...DEFAULT_SETTINGS, friendCode: SEED_FRIEND_CODE },
    presets: [],
    log: [],
    trades: [],
    dismissed: { [STAR_IMPORT]: true, [ONE_STAR_AUTO]: true, [TWO_STAR_AUTO]: true },
  };
}

/**
 * Older saves traded stars only when picked; ★ and ★★ extras (over the keep number) are
 * now offered like ◆. Done once, and only if the setting still holds an earlier default.
 */
function addStarAuto(s: CollectionState): CollectionState {
  if (s.dismissed[TWO_STAR_AUTO]) return s;
  const tiers = [...s.settings.autoTradeTiers].sort().join(',');
  const oldDefaults = ['d1,d2,d3,d4', 'd1,d2,d3,d4,s1'];
  const settings = oldDefaults.includes(tiers) ? { ...s.settings, autoTradeTiers: [...DEFAULT_AUTO_TRADE_TIERS] } : s.settings;
  return { ...s, settings, dismissed: { ...s.dismissed, [ONE_STAR_AUTO]: true, [TWO_STAR_AUTO]: true } };
}

/** Adds the ★/★★ counts to an older save, once, without touching cards that already have a count. */
function addStarCounts(s: CollectionState): CollectionState {
  if (s.dismissed[STAR_IMPORT]) return s;
  const counts = { ...s.counts };
  for (const [key, n] of Object.entries(SEED_STAR_COUNTS)) if (!(key in counts)) counts[key] = n;
  return { ...s, counts, dismissed: { ...s.dismissed, [STAR_IMPORT]: true } };
}

/** Fills in anything missing from an older or hand-edited save. */
export function normalizeState(raw: Partial<CollectionState> | null | undefined): CollectionState {
  const base = seedState();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw.settings ?? ({} as Partial<Settings>);
  return {
    version: 1,
    counts: raw.counts ?? {},
    wanted: raw.wanted ?? {},
    locked: raw.locked ?? {},
    forTrade: raw.forTrade ?? {},
    settings: {
      ...DEFAULT_SETTINGS,
      ...s,
      autoTradeTiers: Array.isArray(s.autoTradeTiers) ? s.autoTradeTiers : DEFAULT_AUTO_TRADE_TIERS,
      setTags: { ...(s.setTags ?? {}) },
      post: { ...DEFAULT_SETTINGS.post, ...(s.post ?? {}) },
      collage: { ...DEFAULT_SETTINGS.collage, ...(s.collage ?? {}) },
    },
    presets: raw.presets ?? [],
    log: raw.log ?? [],
    trades: raw.trades ?? [],
    dismissed: raw.dismissed ?? {},
  };
}

function load(): CollectionState {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text) return addStarAuto(addStarCounts(normalizeState(JSON.parse(text))));
  } catch {
    /* fall through to the starting data */
  }
  return seedState();
}

let state: CollectionState = load();
const listeners = new Set<() => void>();
const undoStack: { prev: CollectionState; label: string }[] = [];

let saveTimer: number | undefined;
function persistSoon() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(persistNow, 150);
}
function persistNow() {
  window.clearTimeout(saveTimer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    notify('Could not save on this device (storage is full or blocked). Export a backup from Settings.');
  }
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persistNow());
}

function commit(next: CollectionState, label?: string) {
  if (label) {
    undoStack.push({ prev: state, label });
    if (undoStack.length > 60) undoStack.shift();
  }
  state = next;
  persistSoon();
  listeners.forEach((l) => l());
  if (label) notify(label, true);
}

/** Adds rarities to the share post, so cards you just picked actually show up in it. */
function withPostTiers(s: CollectionState, tiers: RarityTier[] | undefined): CollectionState {
  const add = (tiers ?? []).filter((t) => !s.settings.post.tiers.includes(t));
  if (!add.length) return s;
  return { ...s, settings: { ...s.settings, post: { ...s.settings.post, tiers: [...s.settings.post.tiers, ...new Set(add)] } } };
}

function withLog(s: CollectionState, entries: LogEntry[]): LogEntry[] {
  const log = [...s.log, ...entries];
  return log.length > MAX_LOG ? log.slice(log.length - MAX_LOG) : log;
}

/** Applies count changes, logging them and clearing "need" marks that are now met. */
function applyCounts(
  s: CollectionState,
  changes: { key: string; to: number }[],
  reason: Reason,
): { next: CollectionState; unwanted: string[] } {
  const counts = { ...s.counts };
  let wanted = s.wanted;
  const entries: LogEntry[] = [];
  const unwanted: string[] = [];
  const t = Date.now();
  for (const { key, to } of changes) {
    const from = counts[key] ?? 0;
    const value = Math.max(0, Math.min(999, Math.round(to)));
    if (value === from) continue;
    if (value === 0) delete counts[key];
    else counts[key] = value;
    entries.push({ t, key, from, to: value, reason });
    if (s.settings.autoUnwant && wanted[key] && value >= s.settings.keep && value > from) {
      if (wanted === s.wanted) wanted = { ...wanted };
      delete wanted[key];
      unwanted.push(key);
    }
  }
  return { next: { ...s, counts, wanted, log: withLog(s, entries) }, unwanted };
}

export const store = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  setCount(key: string, to: number, label: string, reason: Reason = 'edit') {
    const { next, unwanted } = applyCounts(state, [{ key, to }], reason);
    if (next === state || next.counts === state.counts) return;
    commit(next, unwanted.length ? `${label} · removed from needs` : label);
  },

  adjust(key: string, delta: number, label: (from: number, to: number) => string, reason: Reason = 'tap') {
    const from = state.counts[key] ?? 0;
    const to = Math.max(0, from + delta);
    if (to === from) return;
    store.setCount(key, to, label(from, to), reason);
  },

  setManyCounts(changes: { key: string; to: number }[], label: string) {
    const { next } = applyCounts(state, changes, 'bulk');
    commit(next, label);
  },

  toggleWanted(key: string, label: (on: boolean) => string, tier?: RarityTier) {
    const wanted = { ...state.wanted };
    const on = !wanted[key];
    if (on) wanted[key] = true;
    else delete wanted[key];
    const next = { ...state, wanted };
    commit(on ? withPostTiers(next, tier && [tier]) : next, label(on));
  },

  setWanted(keys: string[], on: boolean, label: string, tiers?: RarityTier[]) {
    const wanted = { ...state.wanted };
    for (const k of keys) {
      if (on) wanted[k] = true;
      else delete wanted[k];
    }
    const next = { ...state, wanted };
    commit(on ? withPostTiers(next, tiers) : next, label);
  },

  toggleLocked(key: string, label: (on: boolean) => string) {
    const locked = { ...state.locked };
    const forTrade = { ...state.forTrade };
    const on = !locked[key];
    if (on) {
      locked[key] = true;
      delete forTrade[key];
    } else delete locked[key];
    commit({ ...state, locked, forTrade }, label(on));
  },

  /** Puts a card on the For Trade list or takes it off, whatever its rarity's rule. */
  toggleForTrade(card: Card) {
    if (!card.tradeable) {
      notify(`${card.name}: this rarity can't be traded in the game.`);
      return;
    }
    if (!(state.counts[card.key] ?? 0)) {
      notify(`${card.name}: you don't have this card yet.`);
      return;
    }
    const ctx = tradeCtx(state);
    const on = isForTrade(card, ctx);
    const locked = { ...state.locked };
    const forTrade = { ...state.forTrade };
    if (on) {
      delete forTrade[card.key];
      // Spares in an automatic rarity would come straight back, so mark it "never trade".
      if (autoQualifies(card, ctx)) locked[card.key] = true;
    } else {
      delete locked[card.key];
      if (!autoQualifies(card, ctx)) forTrade[card.key] = true;
    }
    const next = { ...state, locked, forTrade };
    commit(on ? next : withPostTiers(next, [card.tier]), `${card.name} ${on ? 'taken off' : 'put on'} your For Trade list`);
  },

  /** Marks or unmarks many cards as willing to trade at once. */
  setForTrade(keys: string[], on: boolean, label: string, tiers?: RarityTier[]) {
    const forTrade = { ...state.forTrade };
    const locked = { ...state.locked };
    for (const k of keys) {
      if (on) {
        forTrade[k] = true;
        delete locked[k];
      } else delete forTrade[k];
    }
    const next = { ...state, forTrade, locked };
    commit(on ? withPostTiers(next, tiers) : next, label);
  },

  /** One in-game trade: give one copy, get one copy (either side optional). */
  trade(give: string | undefined, get: string | undefined, label: string) {
    const changes: { key: string; to: number }[] = [];
    if (give) changes.push({ key: give, to: (state.counts[give] ?? 0) - 1 });
    if (get) changes.push({ key: get, to: (state.counts[get] ?? 0) + 1 });
    const { next, unwanted } = applyCounts(state, changes, 'trade');
    const trades = [...next.trades, { t: Date.now(), give, get }].slice(-300);
    commit({ ...next, trades }, unwanted.length ? `${label} · removed from needs` : label);
  },

  updateSettings(patch: Partial<Settings>) {
    commit({ ...state, settings: { ...state.settings, ...patch } });
  },
  updatePost(patch: Partial<PostSettings>) {
    commit({ ...state, settings: { ...state.settings, post: { ...state.settings.post, ...patch } } });
  },
  updateCollage(patch: Partial<CollageSettings>) {
    commit({ ...state, settings: { ...state.settings, collage: { ...state.settings.collage, ...patch } } });
  },

  savePreset(name: string, filters: Filters) {
    const preset = { id: `u${Date.now()}`, name, filters };
    commit({ ...state, presets: [...state.presets, preset] });
  },
  deletePreset(id: string) {
    commit({ ...state, presets: state.presets.filter((p) => p.id !== id) });
  },

  dismiss(id: string) {
    commit({ ...state, dismissed: { ...state.dismissed, [id]: true } });
  },

  replaceAll(next: CollectionState, label: string) {
    commit(normalizeState(next), label);
  },

  /** Takes in a collection merged with your other devices. Not undoable (the undo history is cleared). */
  applySynced(next: CollectionState) {
    undoStack.length = 0;
    state = next;
    persistNow();
    listeners.forEach((l) => l());
  },

  resetToStart() {
    commit(seedState(), 'Collection reset to the starting counts');
  },

  canUndo: () => undoStack.length > 0,
  undoLabel: () => undoStack[undoStack.length - 1]?.label,
  undo() {
    const last = undoStack.pop();
    if (!last) return;
    state = last.prev;
    persistSoon();
    listeners.forEach((l) => l());
    notify(`Undid: ${last.label}`, undoStack.length > 0);
  },
};

export function tradeCtx(s: Pick<CollectionState, 'counts' | 'locked' | 'forTrade' | 'settings'>): TradeCtx {
  return {
    counts: s.counts,
    locked: s.locked,
    forTrade: s.forTrade,
    keep: s.settings.keep,
    autoTradeTiers: s.settings.autoTradeTiers,
  };
}

export function useCollection<T>(select: (s: CollectionState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(state));
}

// ---- Small notice ("toast") channel -------------------------------------------------

export interface Notice {
  id: number;
  text: string;
  undoable: boolean;
}
let notice: Notice | null = null;
const noticeListeners = new Set<() => void>();
let noticeTimer: number | undefined;

export function notify(text: string, undoable = false) {
  notice = { id: Date.now(), text, undoable };
  noticeListeners.forEach((l) => l());
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(clearNotice, undoable ? 5000 : 3500);
}
export function clearNotice() {
  notice = null;
  noticeListeners.forEach((l) => l());
}
export function useNotice(): Notice | null {
  return useSyncExternalStore(
    (fn) => {
      noticeListeners.add(fn);
      return () => noticeListeners.delete(fn);
    },
    () => notice,
  );
}
